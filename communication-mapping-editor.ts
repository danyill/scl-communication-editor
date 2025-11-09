import {
  LitElement,
  nothing,
  css,
  html,
  svg,
  TemplateResult,
  PropertyValues,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import '@material/mwc-icon-button';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-textfield';
import type { IconButtonToggle } from '@material/mwc-icon-button-toggle';

import { Edit, newEditEvent } from '@openenergytools/open-scd-core';

import { getReference, identity } from '@openenergytools/scl-lib';

import { sldSvg } from './foundation/sldSvg.js';
import {
  Point,
  attributes,
  containsRect,
  reparentElement,
  sldNs,
  sldPrefix,
  svgNs,
  xlinkNs,
} from './foundation/sldUtil.js';
import { serviceColoring, svgConnectionGenerator } from './foundation/paths.js';
import { IED, Connection } from './foundation/types.js';
import { getCommAddress } from './foundation/utils.js';

import '@scopedelement/material-web/checkbox/checkbox.js';
import '@scopedelement/material-web/list/list.js';
import '@scopedelement/material-web/list/list-item.js';
import '@scopedelement/material-web/button/text-button.js';
import '@scopedelement/material-web/fab/fab.js';
import '@scopedelement/material-web/icon/icon.js';

export class CommunicationMappingEditor extends ScopedElementsMixin(
  LitElement
) {
  static scopedElements = {
    'mwc-textfield': customElements.get('mwc-textfield'),
    'mwc-icon-button': customElements.get('mwc-icon-button'),
    'mwc-icon-button-toggle': customElements.get('mwc-icon-button-toggle'),
    'md-list': customElements.get('md-list'),
    'md-list-item': customElements.get('md-list-item'),
    'md-checkbox': customElements.get('md-checkbox'),
    'md-text-button': customElements.get('md-text-button'),
    'md-fab': customElements.get('md-fab'),
    'md-icon': customElements.get('md-icon'),
  };

  @property({ attribute: false })
  substation!: Element;

  @property({ type: Number })
  gridSize!: number;

  @property({ attribute: false, hasChanged: (v, o) => v !== o })
  connections: Connection[] = [];

  @state()
  get ieds(): IED[] {
    return Array.from(
      this.substation.ownerDocument.getElementsByTagNameNS(sldNs, 'IEDName')
    )
      .map(iedName => {
        const ied = this.substation.ownerDocument.querySelector(
          `:scope > IED[name="${
            iedName.getAttributeNS(sldNs, 'name') ?? 'Unknown IED'
          }"]`
        );
        return {
          element: iedName,
          ied,
          name: iedName.getAttribute('name')!,
        };
      })
      .filter(
        (iedName): iedName is IED & { ied: Element } => iedName.ied !== null
      );
  }

  @state() filterReport = false;

  @state() filterGOOSE = false;

  @state() filterSMV = false;

  @state() selectedIed?: Element;

  @state() filterRcv = false;

  @state() filterSend = false;

  @state() sourceIEDFilter = '';

  @state() targetIEDFilter = '';

  @state() cbNameFilter = '';

  @state() vlanFilter = '';

  @state() priorityFilter = '';

  @state({ hasChanged: (v, o) => v !== o })
  selectedVlans: string[] = [];

  @state() selectedPriorities: string[] = [];

  @state() showFilterBox = false;

  @state() showVlanDropdown = false;

  @state() showPriorityDropdown = false;

  // Manufacturer / IED type filter states
  @state() showManufacturerDropdown = false;

  @state() manufacturerValues: string[] = [];

  @state() typeValues: string[] = [];

  @state() manufacturerTypeMap: Record<string, string[]> = {};

  @state() selectedManufacturers: string[] = [];

  @state() selectedTypes: string[] = [];

  @state() editMode = false;

  @state() showLabel = true;

  @state() placing?: Element;

  @state() placingLabel?: Element;

  @state() placingOffset: Point = [0, 0];

  @state() vlanValues: string[] = [];

  @state() priorityValues: string[] = [];

  mouseX = 0;

  mouseY = 0;

  mouseX2 = 0;

  mouseY2 = 0;

  @state() linkedEquipments: Element[] = [];

  @state()
  get idle(): boolean {
    return !(this.placing || this.placingLabel);
  }

  @query('svg#sldContainer')
  sld!: SVGGraphicsElement;

  @query('#container') container!: HTMLDivElement;

  svgCoordinates(clientX: number, clientY: number) {
    const p = new DOMPoint(clientX, clientY);
    const { x, y } = p.matrixTransform(this.sld.getScreenCTM()!.inverse());
    return [x, y].map(coord => Math.max(0, coord)) as Point;
  }

  handleKeydown = ({ key }: KeyboardEvent) => {
    if (key === 'Escape') this.reset();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeydown);
  }

  reset() {
    this.placing = undefined;
    this.placingLabel = undefined;
  }

  placeLabel(element: Element, x: number, y: number) {
    this.dispatchEvent(
      newEditEvent({
        element,
        attributes: {
          [`${sldPrefix}:lx`]: { namespaceURI: sldNs, value: x.toString() },
          [`${sldPrefix}:ly`]: { namespaceURI: sldNs, value: y.toString() },
        },
      })
    );
    this.reset();
  }

  startPlacingLabel(element: Element | undefined, offset: Point = [0, 0]) {
    this.reset();
    this.placingLabel = element;
    this.placingOffset = offset;
  }

  placeElement(element: Element, x: number, y: number) {
    const edits: Edit[] = [];

    const oldParent = element.parentElement;

    const newParent =
      Array.from(
        this.substation.querySelectorAll(':scope > VoltageLevel > Bay')
      )
        .concat(
          Array.from(this.substation.querySelectorAll(':scope > VoltageLevel'))
        )
        .find(vlOrBay => containsRect(vlOrBay, x, y, 1, 1)) || this.substation;

    if (element.parentElement !== newParent) {
      edits.push(...reparentElement(element, newParent));
    }

    const {
      pos: [oldX, oldY],
      label: [oldLX, oldLY],
    } = attributes(element);

    const dx = x - oldX;
    const dy = y - oldY;

    const lx = oldLX;
    const ly = oldLY;

    edits.push({
      element,
      attributes: {
        x: { namespaceURI: sldNs, value: x.toString() },
        y: { namespaceURI: sldNs, value: y.toString() },
        lx: { namespaceURI: sldNs, value: (lx + dx).toString() },
        ly: { namespaceURI: sldNs, value: (ly + dy).toString() },
      },
    });

    this.dispatchEvent(newEditEvent(edits));

    const enclosingEdits: Edit[] = [];
    if (
      element.localName === 'IEDName' &&
      element.namespaceURI === sldNs &&
      element.parentElement &&
      element.parentElement?.tagName !== 'Private'
    ) {
      let privateElement: Element | null = element.parentElement!.querySelector(
        ':scope > Private[type="OpenSCD-Linked-IEDs"]'
      );

      if (!privateElement) {
        privateElement = this.substation.ownerDocument.createElementNS(
          this.substation.ownerDocument.documentElement.namespaceURI,
          'Private'
        );
        privateElement.setAttribute('type', 'OpenSCD-Linked-IEDs');
      }

      privateElement.appendChild(element.cloneNode());

      enclosingEdits.push(
        {
          parent: element.parentElement!,
          node: privateElement,
          reference: getReference(element.parentElement!, 'Private'),
        },
        {
          node: element,
        }
      );
    }

    if (
      element.localName === 'IEDName' &&
      oldParent?.tagName === 'Private' &&
      oldParent?.getAttribute('type') === 'OpenSCD-Linked-IEDs' &&
      oldParent.childElementCount === 0
    ) {
      enclosingEdits.push({ node: oldParent });
    }

    if (enclosingEdits.length) this.dispatchEvent(newEditEvent(enclosingEdits));

    this.reset();
  }

  startPlacing(element: Element | undefined, offset: Point = [0, 0]) {
    this.reset();
    this.placing = element;
    this.placingOffset = offset;
  }

  onWheelZoom(evt: WheelEvent): void {
    if (evt.ctrlKey) {
      evt.preventDefault();
      if (
        (evt.deltaY < 0 && this.gridSize >= 10) ||
        (evt.deltaY > 0 && this.gridSize <= 200)
      ) {
        const d = evt.deltaY < 0 ? -1 : 1;
        const f = (this.gridSize + d) / this.gridSize;

        const xs = this.container.scrollLeft;
        const xa = evt.offsetX;

        const dx = (f - 1) * (xs + xa);

        const ys = this.container.scrollTop;
        const ya = evt.offsetY - 57;

        const dy = (f - 1) * (ys + ya);

        this.container.scrollBy(dx, dy);
        this.gridSize += d;
      }
    }
  }

  clearFilter(): void {
    this.sourceIEDFilter = '';
    this.targetIEDFilter = '';
    this.cbNameFilter = '';
    this.vlanFilter = '';
    this.priorityFilter = '';
    this.selectedVlans = [];
    this.selectedPriorities = [];
    this.selectedManufacturers = [];
    this.selectedTypes = [];
  }

  activeFilter(): boolean {
    return (
      this.sourceIEDFilter !== '' ||
      this.targetIEDFilter !== '' ||
      this.cbNameFilter !== '' ||
      this.vlanFilter !== '' ||
      this.priorityFilter !== '' ||
      this.selectedVlans.length > 0 ||
      this.selectedPriorities.length > 0 ||
      this.selectedManufacturers.length > 0 ||
      this.selectedTypes.length > 0
    );
  }

  filterCbName(conn: Connection): boolean {
    if (this.cbNameFilter === '') return false;

    const terms = this.cbNameFilter.split(' ');

    const iedName = conn.source.controlBlock.getAttribute('name')!;

    return !terms.some(term => iedName.includes(term));
  }

  filterSourceIED(conn: Connection): boolean {
    if (this.sourceIEDFilter === '') return false;
    const terms = this.sourceIEDFilter.split(' ');
    const iedName = conn.source.ied.getAttribute('name')!;
    return !terms.some(term => iedName.includes(term));
  }

  filterTargetIED(conn: Connection): boolean {
    if (this.targetIEDFilter === '') return false;
    const terms = this.targetIEDFilter.split(' ');
    const iedName = conn.target.ied.getAttribute('name')!;
    return !terms.some(term => iedName.includes(term));
  }

  static parseCsvTokens(text: string): string[] {
    return text
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '');
  }

  static matchPriorityToken(
    prioText: string | null | undefined,
    token: string
  ): boolean {
    if (!prioText) return false;
    const pt = prioText.trim();
    const tk = token.trim();
    if (pt === tk) return true;
    const pNum = Number(pt);
    const tNum = Number(tk);
    if (!Number.isNaN(pNum) && !Number.isNaN(tNum)) return pNum === tNum;
    return false;
  }

  static matchVlanToken(
    vlanText: string | null | undefined,
    token: string
  ): boolean {
    const vNum = CommunicationMappingEditor.parseVlanRawToNumber(vlanText);
    const tNum = CommunicationMappingEditor.parseVlanTokenToNumber(token);
    if (vNum === null || tNum === null) return false;
    return vNum === tNum;
  }

  // Parse a VLAN value as it appears in SCL (raw, may be decimal or hex-like)
  static parseVlanRawToNumber(text: string | null | undefined): number | null {
    if (!text) return null;
    const t = text.trim();
    if (!t) return null;
    // explicit hex with 0x
    if (/^0x[0-9a-f]+$/i.test(t)) {
      const n = Number.parseInt(t.slice(2), 16);
      return Number.isNaN(n) ? null : n;
    }
    // SCL stores VLAN-ID as hex string (no 0x). Treat hex-like as hex by default.
    if (/^[0-9a-f]+$/i.test(t)) {
      const n = Number.parseInt(t, 16);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  // Parse user-entered token; default to decimal unless explicit hex (0x) or contains a-f
  static parseVlanTokenToNumber(
    text: string | null | undefined
  ): number | null {
    if (!text) return null;
    const t = text.trim();
    if (!t) return null;
    if (/^0x[0-9a-f]+$/i.test(t)) {
      const n = Number.parseInt(t.slice(2), 16);
      return Number.isNaN(n) ? null : n;
    }
    if (/^[0-9]+$/.test(t)) {
      const n = Number.parseInt(t, 10);
      return Number.isNaN(n) ? null : n;
    }
    if (/^[0-9a-f]+$/i.test(t) && /[a-f]/i.test(t)) {
      const n = Number.parseInt(t, 16);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  static canonicalVlanDecimal(text: string | null | undefined): string {
    const n = CommunicationMappingEditor.parseVlanRawToNumber(text);
    return n === null ? '' : String(n);
  }

  // Priority parsing/canonicalization
  static parsePriorityRawToNumber(
    text: string | null | undefined
  ): number | null {
    if (!text) return null;
    const t = text.trim();
    if (!t) return null;
    if (/^[0-9]+$/.test(t)) {
      const n = Number.parseInt(t, 10);
      return Number.isNaN(n) ? null : n;
    }
    // accept hex raw just in case (uncommon)
    if (/^0x[0-9a-f]+$/i.test(t)) {
      const n = Number.parseInt(t.slice(2), 16);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  static parsePriorityTokenToNumber(
    text: string | null | undefined
  ): number | null {
    if (!text) return null;
    const t = text.trim();
    if (!t) return null;
    if (/^0x[0-9a-f]+$/i.test(t)) {
      const n = Number.parseInt(t.slice(2), 16);
      return Number.isNaN(n) ? null : n;
    }
    if (/^[0-9]+$/.test(t)) {
      const n = Number.parseInt(t, 10);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  static canonicalPriorityDecimal(text: string | null | undefined): string {
    const n = CommunicationMappingEditor.parsePriorityRawToNumber(text);
    return n === null ? '' : String(n);
  }

  private parseVlanInputToSelected(text: string): void {
    const rawTokens = CommunicationMappingEditor.parseCsvTokens(text);
    const availableCanonicals = new Map<string, string>();
    this.vlanValues.forEach(raw => {
      const c = CommunicationMappingEditor.canonicalVlanDecimal(raw);
      if (c) availableCanonicals.set(c, raw);
    });

    const selectedCanonical = new Set<string>();
    rawTokens.forEach(t => {
      const n = CommunicationMappingEditor.parseVlanTokenToNumber(t);
      const c = n === null ? '' : String(n);
      if (c && availableCanonicals.has(c)) selectedCanonical.add(c);
    });

    this.selectedVlans = Array.from(selectedCanonical.values()).sort(
      (a, b) => Number(a) - Number(b)
    );

    this.vlanFilter = this.selectedVlans.join(',');
  }

  private syncVlanFilterFromSelection(): void {
    const canonical = this.selectedVlans.join(',');
    if (this.vlanFilter !== canonical) this.vlanFilter = canonical;
  }

  private handleVlanTextInput(evt: Event): void {
    const text = (evt.target as HTMLInputElement).value;
    this.vlanFilter = text;
    this.parseVlanInputToSelected(text);
  }

  private toggleVlanSelection(v: string) {
    const canonical = CommunicationMappingEditor.canonicalVlanDecimal(v);
    if (!canonical) return;
    const sel = this.selectedVlans;
    this.selectedVlans = sel.includes(canonical)
      ? sel.filter(x => x !== canonical)
      : [...sel, canonical];
    this.selectedVlans.sort((a, b) => Number(a) - Number(b));
    this.syncVlanFilterFromSelection();
  }

  // Priority two-way sync helpers
  private parsePriorityInputToSelected(text: string): void {
    const rawTokens = CommunicationMappingEditor.parseCsvTokens(text);
    const availableCanonicals = new Map<string, string>();
    this.priorityValues.forEach(raw => {
      const c = CommunicationMappingEditor.canonicalPriorityDecimal(raw);
      if (c) availableCanonicals.set(c, raw);
    });

    const selectedCanonical = new Set<string>();
    rawTokens.forEach(t => {
      const n = CommunicationMappingEditor.parsePriorityTokenToNumber(t);
      const c = n === null ? '' : String(n);
      if (c && availableCanonicals.has(c)) selectedCanonical.add(c);
    });

    this.selectedPriorities = Array.from(selectedCanonical.values()).sort(
      (a, b) => Number(a) - Number(b)
    );

    this.priorityFilter = this.selectedPriorities.join(',');
  }

  private syncPriorityFilterFromSelection(): void {
    const canonical = this.selectedPriorities.join(',');
    if (this.priorityFilter !== canonical) this.priorityFilter = canonical;
  }

  private handlePriorityTextInput(evt: Event): void {
    const text = (evt.target as HTMLInputElement).value;
    this.priorityFilter = text;
    this.parsePriorityInputToSelected(text);
  }

  private togglePrioritySelection(p: string) {
    const canonical = CommunicationMappingEditor.canonicalPriorityDecimal(p);
    if (!canonical) return;
    const sel = this.selectedPriorities;
    this.selectedPriorities = sel.includes(canonical)
      ? sel.filter(x => x !== canonical)
      : [...sel, canonical];
    this.selectedPriorities.sort((a, b) => Number(a) - Number(b));
    this.syncPriorityFilterFromSelection();
  }

  filterVlan(conn: Connection): boolean {
    if (
      conn.source.controlBlock.tagName !== 'GSEControl' &&
      conn.source.controlBlock.tagName !== 'SampledValueControl'
    )
      return false;

    const comm = getCommAddress(conn.source.controlBlock)?.querySelector(
      'Address'
    );
    const vlanRaw =
      comm?.querySelector('P[type="VLAN-ID"]')?.textContent ?? null;
    const vlanCanonical =
      CommunicationMappingEditor.canonicalVlanDecimal(vlanRaw);

    if (this.vlanFilter !== '') {
      const tokens = CommunicationMappingEditor.parseCsvTokens(this.vlanFilter);
      if (
        tokens.length > 0 &&
        !tokens.some(t => CommunicationMappingEditor.matchVlanToken(vlanRaw, t))
      )
        return true;
    }

    if (this.selectedVlans.length > 0) {
      if (!vlanCanonical || !this.selectedVlans.includes(vlanCanonical))
        return true;
    }

    return false;
  }

  filterPriority(conn: Connection): boolean {
    if (
      conn.source.controlBlock.tagName !== 'GSEControl' &&
      conn.source.controlBlock.tagName !== 'SampledValueControl'
    )
      return false;

    const comm = getCommAddress(conn.source.controlBlock)?.querySelector(
      'Address'
    );
    const prioRaw =
      comm?.querySelector('P[type="VLAN-PRIORITY"]')?.textContent ?? null;
    const prioCanonical =
      CommunicationMappingEditor.canonicalPriorityDecimal(prioRaw);

    if (this.priorityFilter !== '') {
      const tokens = CommunicationMappingEditor.parseCsvTokens(
        this.priorityFilter
      );
      if (
        tokens.length > 0 &&
        !tokens.some(t => {
          const n = CommunicationMappingEditor.parsePriorityTokenToNumber(t);
          return n !== null && String(n) === prioCanonical;
        })
      )
        return true;
    }

    if (this.selectedPriorities.length > 0) {
      if (!prioCanonical || !this.selectedPriorities.includes(prioCanonical))
        return true;
    }

    return false;
  }

  // Manufacturer filter: exclude when active and neither endpoint matches
  filterManufacturer(conn: Connection): boolean {
    if (this.selectedManufacturers.length === 0) return false;
    const sMan = conn.source.ied.getAttribute('manufacturer') || '';
    const tMan = conn.target.ied.getAttribute('manufacturer') || '';
    return !(
      this.selectedManufacturers.includes(sMan) ||
      this.selectedManufacturers.includes(tMan)
    );
  }

  // IED type filter: exclude when active and neither endpoint matches
  filterIedType(conn: Connection): boolean {
    if (this.selectedTypes.length === 0) return false;
    const sType = conn.source.ied.getAttribute('type') || '';
    const tType = conn.target.ied.getAttribute('type') || '';
    return !(
      this.selectedTypes.includes(sType) || this.selectedTypes.includes(tType)
    );
  }

  filterConnections(conn: Connection) {
    const service =
      (conn.source.controlBlock.tagName === 'ReportControl' &&
        this.filterReport) ||
      (conn.source.controlBlock.tagName === 'GSEControl' && this.filterGOOSE) ||
      (conn.source.controlBlock.tagName === 'SampledValueControl' &&
        this.filterSMV);

    const ied =
      !!this.selectedIed &&
      conn.source.iedName !== this.selectedIed &&
      conn.target.iedName !== this.selectedIed;

    const source = this.filterSourceIED(conn);

    const target = this.filterTargetIED(conn);

    const cbName = this.filterCbName(conn);

    const vlan = this.filterVlan(conn);

    const priority = this.filterPriority(conn);

    const manufacturer = this.filterManufacturer(conn);

    const iedType = this.filterIedType(conn);

    // Correct directional filtering relative to the selected IED
    const receive =
      this.filterRcv &&
      !!this.selectedIed &&
      conn.target.iedName === this.selectedIed;
    const send =
      this.filterSend &&
      !!this.selectedIed &&
      conn.source.iedName === this.selectedIed;

    return !(
      service ||
      ied ||
      source ||
      target ||
      cbName ||
      receive ||
      send ||
      vlan ||
      priority ||
      manufacturer ||
      iedType
    );
  }

  resetIedSelection(): void {
    this.selectedIed = undefined;
    // if an IED is deselected and set to show nothing then don't allow
    // nothing for when there is next an IED selected.
    if (this.filterRcv === true && this.filterSend === true) {
      this.filterRcv = false;
      this.filterSend = false;
    }
    this.linkedEquipments = [];
  }

  selectIED(ied: IED): void {
    if (this.selectedIed !== ied.element) {
      this.selectedIed = ied.element;
      const iedName = this.selectedIed.getAttributeNS(sldNs, 'name');
      this.linkedEquipments = Array.from(
        this.selectedIed.ownerDocument.querySelectorAll(
          `ConductingEquipment LNode[iedName="${iedName}"]`
        )
      ).map(lNode => lNode.closest('ConductingEquipment')!);
    } else this.resetIedSelection();
  }

  constructor() {
    super();

    this.addEventListener('wheel', this.onWheelZoom);
  }

  renderedLabelPosition(element: Element): Point {
    let {
      label: [x, y],
    } = attributes(element);
    const [offsetX, offsetY] = this.placingOffset;

    if (
      this.placing &&
      element.closest(this.placing.localName) === this.placing &&
      element.closest(this.placing.localName)?.namespaceURI ===
        this.placing.namespaceURI
    ) {
      const {
        pos: [parentX, parentY],
      } = attributes(this.placing);
      x += this.mouseX - parentX - offsetX;
      y += this.mouseY - parentY - offsetY;
    }

    if (this.placingLabel === element) {
      x = this.mouseX2 - 0.5 - offsetX;
      y = this.mouseY2 + 0.5 - offsetY;
    }

    return [x, y];
  }

  renderLabel(ied: IED) {
    const deg = 0;
    const text = ied.element.getAttributeNS(sldNs, 'name');
    const weight = 400;
    const color = 'black';
    const [x, y] = this.renderedLabelPosition(ied.element);

    const fontSize = 0.45;
    let events = 'none';
    let handleClick: (() => void) | symbol = nothing;
    if (this.idle && this.editMode) {
      events = 'all';
      const offset = [this.mouseX2 - x - 0.5, this.mouseY2 - y + 0.5] as Point;
      handleClick = () => this.startPlacingLabel(ied.element, offset);
    }
    const id = identity(ied.ied);
    const classes = classMap({
      label: true,
      ied: true,
    });
    return svg`<g class="${classes}" id="label:${id}"
                 transform="rotate(${deg} ${x + 0.5} ${y - 0.5})">
        <text x="${x + 0.1}" y="${y - 0.5}"
          alignment-baseline="central"
          @click=${handleClick}
          pointer-events="${events}" fill="${color}" font-weight="${weight}"
          font-size="${fontSize}px" font-family="Roboto, sans-serif"
          style="cursor: default;">
          ${text}
        </text>
      </g>`;
  }

  renderedPosition(element: Element): Point {
    let {
      pos: [x, y],
    } = attributes(element);

    const nearestPlacingElement = this.placing
      ? element.closest(this.placing.localName)
      : null;
    if (
      this.placing &&
      nearestPlacingElement === this.placing &&
      nearestPlacingElement?.namespaceURI === this.placing.namespaceURI
    ) {
      const {
        pos: [parentX, parentY],
      } = attributes(this.placing);
      const [offsetX, offsetY] = this.placingOffset;
      x += this.mouseX - parentX - offsetX;
      y += this.mouseY - parentY - offsetY;
    }
    return [x, y];
  }

  renderIED(ied: IED) {
    const [x, y] = this.renderedPosition(ied.element);

    const symbol = 'IED';
    const icon = svg`<use href="#${symbol}" xlink:href="#${symbol}"
                pointer-events="none" />`;

    const isSelected = this.selectedIed === ied.element && !this.editMode;
    const backgroundRect = isSelected
      ? svg`<rect width="1" height="1" fill="#ffcc00" pointer-events="none" />`
      : nothing;

    let handleClick: (() => void) | symbol = nothing;
    if (this.idle && this.editMode)
      handleClick = () => this.startPlacing(ied.element);
    else if (!this.editMode)
      handleClick = () => {
        this.selectIED(ied);
      };

    return svg`<svg
    xmlns="${svgNs}"
    xmlns:xlink="${xlinkNs}"
    id="${identity(ied.ied)}"
    x="${x}"
    y="${y}"
    width="${1 * this.gridSize}"
    height="${1 * this.gridSize}"
    stroke-width="0.06"
    fill="none">
    <g class="ied ${isSelected ? 'selected-ied' : ''}"
      id="#${ied.name}"
      transform="translate(${0} ${0})">
        <title>${ied.name}</title>
        ${backgroundRect}
        ${icon}
        <rect width="1" height="1" fill="none" pointer-events="all"
        @click=${handleClick}
        />
      </g></svg>`;
  }

  private computeVlanPriorityValues(): void {
    const vlanSet = new Set<string>();
    const prioSet = new Set<string>();
    for (const c of this.connections) {
      const tag = c.source.controlBlock.tagName;
      if (tag === 'GSEControl' || tag === 'SampledValueControl') {
        const gseOrSmv = getCommAddress(c.source.controlBlock);
        const address = gseOrSmv?.querySelector('Address');
        if (address) {
          const v = address
            .querySelector('P[type="VLAN-ID"]')
            ?.textContent?.trim();
          const p = address
            .querySelector('P[type="VLAN-PRIORITY"]')
            ?.textContent?.trim();
          if (v) vlanSet.add(v);
          if (p) prioSet.add(p);
        }
      }
    }
    this.vlanValues = Array.from(vlanSet.values()).sort((a, b) => {
      const an = CommunicationMappingEditor.parseVlanRawToNumber(a);
      const bn = CommunicationMappingEditor.parseVlanRawToNumber(b);
      if (an !== null && bn !== null) return an - bn;
      return a.localeCompare(b);
    });
    this.priorityValues = Array.from(prioSet.values()).sort((a, b) => {
      const an = CommunicationMappingEditor.parsePriorityRawToNumber(a);
      const bn = CommunicationMappingEditor.parsePriorityRawToNumber(b);
      if (an !== null && bn !== null) return an - bn;
      return a.localeCompare(b);
    });
  }

  private computeManufacturerTypeValues(): void {
    const mMap: Record<string, Set<string>> = {};
    const manufacturers = new Set<string>();
    const types = new Set<string>();
    const ieds = Array.from(
      this.substation.ownerDocument.querySelectorAll(':scope > IED')
    );
    for (const ied of ieds) {
      const man = ied.getAttribute('manufacturer')?.trim() || '';
      const type = ied.getAttribute('type')?.trim() || '';
      if (man) manufacturers.add(man);
      if (type) types.add(type);
      if (man) {
        if (!mMap[man]) mMap[man] = new Set<string>();
        if (type) mMap[man].add(type);
      }
    }
    this.manufacturerValues = Array.from(manufacturers.values()).sort();
    this.typeValues = Array.from(types.values()).sort();
    this.manufacturerTypeMap = Object.fromEntries(
      Object.entries(mMap).map(([man, set]) => [
        man,
        Array.from(set.values()).sort(),
      ])
    );
  }

  // Toggle helpers
  private toggleManufacturerSelection(man: string) {
    // Deprecated: replaced by toggleManufacturerAll; kept for backward compatibility if referenced.
    this.toggleManufacturerAll(man);
  }

  private toggleManufacturerAll(man: string) {
    const types = this.manufacturerTypeMap[man] || [];
    if (types.length === 0) return; // nothing to toggle
    const allSelected = types.every(t => this.selectedTypes.includes(t));
    if (allSelected) {
      // unselect all its types
      this.selectedTypes = this.selectedTypes.filter(t => !types.includes(t));
    } else {
      // select all missing types
      this.selectedTypes = Array.from(
        new Set([...this.selectedTypes, ...types])
      );
    }
    this.recomputeSelectedManufacturers();
  }

  private recomputeSelectedManufacturers() {
    const full: string[] = [];
    for (const man of this.manufacturerValues) {
      const types = this.manufacturerTypeMap[man] || [];
      if (types.length && types.every(t => this.selectedTypes.includes(t)))
        full.push(man);
    }
    this.selectedManufacturers = full;
  }

  private toggleTypeSelection(type: string) {
    this.selectedTypes = this.selectedTypes.includes(type)
      ? this.selectedTypes.filter(t => t !== type)
      : [...this.selectedTypes, type];
    this.recomputeSelectedManufacturers();
  }

  firstUpdated() {
    this.computeVlanPriorityValues();
    this.computeManufacturerTypeValues();
  }

  private toggleVlanExpanded() {
    this.showVlanDropdown = !this.showVlanDropdown;
  }

  private togglePriorityExpanded() {
    this.showPriorityDropdown = !this.showPriorityDropdown;
  }

  renderFilterBox(): TemplateResult {
    if (!this.showFilterBox) return html``;

    const { vlanValues, priorityValues: prioValues } = this;
    const { manufacturerValues, manufacturerTypeMap } = this;

    return html`<div class="filter box" style="">
      <h3 class="filter title">
        Filter connections
        <nav style="float: right; display: flex; gap: 4px;">
          <mwc-icon-button
            icon="restart_alt"
            title="Reset all filters"
            @click="${() => this.clearFilter()}"
          ></mwc-icon-button>
          <mwc-icon-button
            icon="close"
            @click="${() => {
              this.showFilterBox = false;
            }}"
          ></mwc-icon-button>
        </nav>
      </h3>
      <mwc-textfield
        label="Source IED name"
        value="${this.sourceIEDFilter}"
        @input="${(evt: Event) => {
          this.sourceIEDFilter = (evt.target as HTMLInputElement).value;
        }}"
      ></mwc-textfield>
      <mwc-textfield
        label="Target IED name"
        value="${this.targetIEDFilter}"
        @input="${(evt: Event) => {
          this.targetIEDFilter = (evt.target as HTMLInputElement).value;
        }}"
      ></mwc-textfield>
      <mwc-textfield
        label="Control Block name"
        value="${this.cbNameFilter}"
        @input="${(evt: Event) => {
          this.cbNameFilter = (evt.target as HTMLInputElement).value;
        }}"
      ></mwc-textfield>
      <mwc-textfield
        label="VLAN IDs (CSV)"
        helper="Decimal or Hex (e.g. 101, 0x65)"
        value="${this.vlanFilter}"
        @input="${(evt: Event) => {
          this.handleVlanTextInput(evt);
        }}"
      ></mwc-textfield>
      <div class="md-filter-group">
        <md-text-button @click="${() => this.toggleVlanExpanded()}">
          ${this.showVlanDropdown ? 'Hide VLAN IDs' : 'Show VLAN IDs'}
        </md-text-button>
        ${this.showVlanDropdown
          ? html`<md-list>
              ${vlanValues.map(
                v => html`<md-list-item
                  @click="${() => this.toggleVlanSelection(v)}"
                >
                  <md-checkbox
                    slot="start"
                    ?checked="${this.selectedVlans.includes(
                      CommunicationMappingEditor.canonicalVlanDecimal(v)
                    )}"
                  ></md-checkbox>
                  <span>
                    ${(() => {
                      const n =
                        CommunicationMappingEditor.parseVlanRawToNumber(v);
                      if (n === null) return v;
                      const hex = `0x${n.toString(16).toUpperCase()}`;
                      const dec = String(n);
                      return `${hex} (dec ${dec})`;
                    })()}
                  </span>
                </md-list-item>`
              )}
            </md-list>`
          : nothing}
      </div>
      <mwc-textfield
        label="VLAN Priorities (CSV)"
        value="${this.priorityFilter}"
        @input="${(evt: Event) => {
          this.handlePriorityTextInput(evt);
        }}"
      ></mwc-textfield>
      <div class="md-filter-group">
        <md-text-button @click="${() => this.togglePriorityExpanded()}">
          ${this.showPriorityDropdown
            ? 'Hide VLAN Priorities'
            : 'Show VLAN Priorities'}
        </md-text-button>
        ${this.showPriorityDropdown
          ? html`<md-list>
              ${prioValues.map(
                p => html`<md-list-item
                  @click="${() => this.togglePrioritySelection(p)}"
                >
                  <md-checkbox
                    slot="start"
                    ?checked="${this.selectedPriorities.includes(
                      CommunicationMappingEditor.canonicalPriorityDecimal(p)
                    )}"
                  ></md-checkbox>
                  <span>${p}</span>
                </md-list-item>`
              )}
            </md-list>`
          : nothing}
      </div>
      <div class="md-filter-group">
        <md-text-button
          @click="${() => {
            this.showManufacturerDropdown = !this.showManufacturerDropdown;
          }}"
        >
          ${this.showManufacturerDropdown
            ? 'Hide Manufacturers / Types'
            : 'Show Manufacturers / Types'}
        </md-text-button>
        ${this.showManufacturerDropdown
          ? html`<md-list>
              ${manufacturerValues.map(man => {
                const types = manufacturerTypeMap[man] || [];
                const allSelected =
                  types.length > 0 &&
                  types.every(t => this.selectedTypes.includes(t));
                const someSelected =
                  !allSelected &&
                  types.some(t => this.selectedTypes.includes(t));
                return html`
                  <md-list-item @click=${() => this.toggleManufacturerAll(man)}>
                    <md-checkbox
                      slot="start"
                      ?checked=${allSelected}
                      .indeterminate=${someSelected}
                    ></md-checkbox>
                    <span>${man}</span>
                  </md-list-item>
                  ${types.map(
                    t => html`<md-list-item
                      class="type-item"
                      style="padding-left: 32px;"
                      @click=${() => this.toggleTypeSelection(t)}
                    >
                      <md-checkbox
                        slot="start"
                        ?checked=${this.selectedTypes.includes(t)}
                      ></md-checkbox>
                      <span>${t}</span>
                    </md-list-item>`
                  )}
                `;
              })}
            </md-list>`
          : nothing}
      </div>
    </div>`;
  }

  renderFilterFab(): TemplateResult {
    return html`<nav class="filter button">
      ${this.activeFilter()
        ? html`<md-fab label="Clear" @click="${() => this.clearFilter()}">
            <md-icon slot="icon">refresh</md-icon>
          </md-fab>`
        : nothing}
      <md-fab
        @click="${() => {
          this.showFilterBox = true;
        }}"
      >
        <md-icon slot="icon">filter_alt</md-icon>
      </md-fab>
    </nav>`;
  }

  renderService(controlBlock: string): TemplateResult[] {
    return [
      html`<svg viewBox="0 0 25 25" width="25" height="25">
        <path
          d="M0,12.5L25,12.5"
          stroke-width="3"
          stroke="${serviceColoring[controlBlock]}"
        />
      </svg>`,
      html`<div class="serviceFilter">
        <input
          type="checkbox"
          id="serviceFilter"
          name="serviceFilter"
          checked
          @click="${(evt: Event) => {
            if (controlBlock === 'ReportControl')
              this.filterReport = !(evt.target as HTMLInputElement).checked;
            if (controlBlock === 'GSEControl')
              this.filterGOOSE = !(evt.target as HTMLInputElement).checked;
            if (controlBlock === 'SampledValueControl')
              this.filterSMV = !(evt.target as HTMLInputElement).checked;
          }}"
        />
        <label for="serviceFilter">${controlBlock}</label>
      </div>`,
    ];
  }

  renderInfoBox(): TemplateResult {
    const controlBlocks = [
      'ReportControl',
      'GSEControl',
      'SampledValueControl',
    ];

    return html`<div class="info-box">
      ${controlBlocks.map(controlBlock => this.renderService(controlBlock))}
      ${this.selectedIed && !this.editMode
        ? html`<svg viewBox="0 0 25 25" width="25" height="25">
              <path d="M0,12.5L22,12.5" stroke-width="3" stroke="black" />
              <path d="M25,12.5L12.5,18L12.5,7Z" stroke-width="1" />
            </svg>
            <input
              type="checkbox"
              checked
              @click="${(evt: Event) => {
                this.filterRcv = !(evt.target as HTMLInputElement).checked;
              }}"
            />
            <svg viewBox="0 0 25 25" width="25" height="25">
              <path d="M3,12.5L25,12.5" stroke-width="3" stroke="black" />
              <path d="M0,12.5L12.5,18L12.5,7Z" stroke-width="1" />
            </svg>
            <input
              type="checkbox"
              checked
              @click="${(evt: Event) => {
                this.filterSend = !(evt.target as HTMLInputElement).checked;
              }}"
            />`
        : nothing}
      <mwc-icon-button-toggle
        ?on=${this.editMode}
        onIcon="edit"
        offIcon="edit_off"
        @click="${(evt: Event) => {
          this.editMode = (evt.target as IconButtonToggle).on;
          this.resetIedSelection();
        }}"
      ></mwc-icon-button-toggle>
      <mwc-icon-button
        class="zoom"
        icon="zoom_in"
        title="Zoom in"
        @click="${() => {
          this.gridSize += 4;
        }}"
      >
      </mwc-icon-button>
      <mwc-icon-button
        class="zoom"
        icon="zoom_out"
        title="Zoom out"
        @click="${() => {
          this.gridSize -= 4;
        }}"
      >
      </mwc-icon-button>
      <mwc-icon-button-toggle
        ?on=${this.showLabel}
        onIcon="font_download"
        offIcon="font_download_off"
        @click="${(evt: Event) => {
          this.showLabel = (evt.target as IconButtonToggle).on;
        }}"
      ></mwc-icon-button-toggle>
    </div>`;
  }

  render() {
    if (this.connections.length === 0) return html`<p>Nothing to render</p>`;

    const {
      dim: [w, h],
    } = attributes(this.substation);

    const placingLabelTarget = this.placingLabel
      ? svg`<rect width="100%" height="100%" fill="url(#halfgrid)"
      @click=${() => {
        const element = this.placingLabel!;
        const [x, y] = this.renderedLabelPosition(element);
        this.placeLabel(element, x, y);
      }} />`
      : nothing;

    const iedPlacingTarget =
      this.placing?.localName === 'IEDName'
        ? svg`<rect width="100%" height="100%" fill="url(#grid)" 
        @click=${() => {
          const element = this.placing!;
          const [x, y] = this.renderedPosition(element);

          this.placeElement(element, x, y);
        }} />`
        : nothing;

    const filteredConnections = this.connections.filter(
      conn =>
        this.filterConnections(conn) &&
        conn.source.iedName &&
        conn.target.iedName
    );

    const svgConnection = svgConnectionGenerator(
      this.substation,
      filteredConnections
    );

    return html` ${this.renderInfoBox()}
      <div id="container">
        <style>
          ${this.showLabel
            ? nothing
            : `.label:not(.ied):not(.linked) {display: none} `}
        </style>
        <svg
          xmlns="${svgNs}"
          xmlns:xlink="${xlinkNs}"
          viewBox="0 0 ${w} ${h}"
          width="${w * this.gridSize}"
          height="${h * this.gridSize}"
          id="sldContainer"
          stroke-width="0.06"
          fill="none"
          @mousemove=${(e: MouseEvent) => {
            const [x, y] = this.svgCoordinates(e.clientX, e.clientY);
            this.mouseX = Math.floor(x);
            this.mouseY = Math.floor(y);
            this.mouseX2 = Math.round(x * 2) / 2;
            this.mouseY2 = Math.round(y * 2) / 2;
          }}
        >
          ${sldSvg(this.substation, {
            gridSize: this.gridSize,
            linkedEquipments: this.linkedEquipments,
          })}
          ${this.ieds.map(iedName => this.renderIED(iedName))}
          ${this.ieds.map(iedName => this.renderLabel(iedName))}
          ${placingLabelTarget} ${iedPlacingTarget}
          ${filteredConnections.map(link => svgConnection(link))}
        </svg>
      </div>
      ${this.renderFilterFab()} ${this.renderFilterBox()}`;
  }

  static styles = css`
    #container {
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: white;
    }

    g.equipment:not(.linked) {
      opacity: 0.2;
    }

    g.node {
      opacity: 0.2;
    }

    g.transformer {
      opacity: 0.2;
    }

    g.label:not(.ied):not(.linked) {
      opacity: 0.2;
    }

    svg.connection:hover > path {
      stroke: #ffcc00;
      stroke-width: 0.12;
    }

    .info-box {
      display: flex;
      align-items: center;
    }

    .info-box > svg {
      padding-left: 15px;
    }

    .info-box > .serviceFilter > label {
      font-family: 'Roboto';
      font-style: normal;
      font-weight: 400;
    }

    .filter.box > mwc-textfield {
      padding: 6px;
    }

    .filter.box {
      width: 300px;
      height: auto; /* intrinsic */
      max-height: 80vh; /* fallback */
      max-height: calc(100dvh - 20vh); /* dynamic viewport */
      position: fixed;
      bottom: 6px;
      right: 16px;
      border: 2px solid var(--oscd-theme-base01);
      background-color: var(--oscd-theme-base3);
      border-radius: 5px;
      overflow-y: auto;
    }

    .filter.title {
      color: var(--oscd-theme-base01);
      font-family: var(--oscd-theme-text-font, 'Roboto');
      font-weight: 300;
      overflow: clip visible;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin: 0px;
      line-height: 52px;
      padding-left: 0.3em;
      user-select: none; /* make heading text non-selectable */
    }

    .filter.button {
      position: fixed;
      bottom: 15px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter.button md-fab {
      --md-fab-container-color: var(--md-sys-color-primary-container, #e0e0ff);
      --md-fab-label-text-color: var(--md-sys-color-on-primary-container, #000);
    }

    .filter.button md-fab[label='Clear'] {
      padding: 0 10px;
      min-width: 96px;
    }

    .linked > rect {
      fill: black;
      opacity: 0.1;
    }

    md-text-button {
      margin-left: 10px;
    }

    .md-filter-group {
      margin: 8px 10px;
    }

    .md-filter-group md-list {
      max-height: 150px;
      overflow: auto;
      border: 1px solid var(--oscd-theme-base01);
      border-radius: 4px;
    }

    .md-filter-group md-list-item {
      cursor: pointer;
    }

    .md-filter-group md-list-item.type-item span {
      font-size: 0.9em;
      opacity: 0.9;
    }
  `;
}
