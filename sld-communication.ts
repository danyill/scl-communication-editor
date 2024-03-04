/* eslint-disable no-return-assign */
import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

// eslint-disable-next-line import/no-extraneous-dependencies
import {
  newInstance,
  FlowchartConnector,
  BrowserJsPlumbInstance,
  EVENT_DRAG_STOP,
} from '@jsplumb/browser-ui';
import { newEditEvent } from '@openscd/open-scd-core';
import { identity } from '@openenergytools/scl-lib';

const connColor: Record<string, string> = {
  Report: '#268bd2',
  SMV: '#d33682',
  GOOSE: '#2aa198',
};

export interface IED {
  name: string;
  x?: number;
  y?: number;
  labelx?: number;
  labely?: number;
}

export interface Link {
  sink: string;
  source: string;
  type?: string;
}

const nsp = 'esld';
const sldNs = 'https://transpower.co.nz/SCL/SSD/SLD/v0';

const defaultGridSize = 32;

const types: Record<string, string> = {
  GSEControl: 'GOOSE',
  SampledValueControl: 'SMV',
  ReportControl: 'Report',
};

function parseClientLns(doc: XMLDocument): Link[] {
  return Array.from(
    doc.querySelectorAll('ReportControl > RptEnabled > ClientLN')
  ).map(clientLn => {
    const source = clientLn.closest('IED')?.getAttribute('name')!;
    const sink = clientLn.getAttribute('iedName')!;
    const type = 'Report';

    return { source, sink, type };
  });
}

function parseExtRefs(doc?: XMLDocument): Link[] {
  const links: Record<
    string,
    { source: Element; sink: Element; service?: Element }
  > = {};
  Array.from(doc?.querySelectorAll('ExtRef') ?? []).forEach(extRef => {
    const [iedName, srcLDInst, srcLNClass, srcLNInst, srcCBName] = [
      'iedName',
      'srcLDInst',
      'srcLNClass',
      'srcLNInst',
      'srcCBName',
    ].map(attr => extRef.getAttribute(attr) ?? '');

    const sink = extRef.closest('IED');
    const source = doc!.querySelector(`IED[name="${iedName}"]`);

    const service = doc?.querySelector(
      `IED[name="${iedName}"] LDevice[inst="${srcLDInst}"] > *[lnClass="${srcLNClass}"][inst="${srcLNInst}"] > ReportControl[name="${srcCBName}"],
      IED[name="${iedName}"] LDevice[inst="${srcLDInst}"] > *[lnClass="${srcLNClass}"][inst="${srcLNInst}"] > GSEControl[name="${srcCBName}"],
      IED[name="${iedName}"] LDevice[inst="${srcLDInst}"] > *[lnClass="${srcLNClass}"][inst="${srcLNInst}"] > SampledValueControl[name="${srcCBName}"]`
    );

    if (sink && source && service) {
      const id = `${identity(sink)}${identity(source)}${identity(service)}`;
      if (!links[id]) links[id] = { source, sink, service };
    } else if (sink && source) {
      const id = `${identity(sink)}${identity(source)}}`;
      if (!links[id]) links[id] = { source, sink };
    }
  });

  return Object.values(links).map(link => {
    const source = link.source.getAttribute('name')!;
    const sink = link.sink.getAttribute('name')!;
    const type = link.service ? types[link.service.tagName] : undefined;

    return { source, sink, type };
  });
}

@customElement('sld-communication')
export default class SclCommunication extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  @property({ attribute: false })
  editCount = -1;

  @property({ attribute: false })
  gridSize = defaultGridSize;

  @state()
  get ieds(): IED[] {
    return Array.from(this.doc.querySelectorAll(':root > IED')).map(ied => ({
      name: ied.getAttribute('name')!,
      x: parseInt(
        ied
          .querySelector('Private[type="sld-attributes"]')
          ?.getAttribute('esld:x') ?? '0',
        10
      ),
      y: parseInt(
        ied
          .querySelector('Private[type="sld-attributes"]')
          ?.getAttribute('esld:y') ?? '0',
        10
      ),
      labelx: parseInt(
        ied
          .querySelector('Private[type="sld-attributes"]')
          ?.getAttribute('esld:lx') ?? '0',
        10
      ),
      labely: parseInt(
        ied
          .querySelector('Private[type="sld-attributes"]')
          ?.getAttribute('esld:ly') ?? '0',
        10
      ),
    }));
  }

  @state()
  get links(): Link[] {
    return [...parseExtRefs(this.doc), ...parseClientLns(this.doc)];
  }

  @state()
  selectedIed?: IED;

  instance?: BrowserJsPlumbInstance;

  @query(`#container`) divRef!: HTMLDivElement;

  private element(id: string): Element {
    return this.divRef.querySelector(`#${id}`)!;
  }

  protected deselectIed(): void {
    this.instance!.select().each(conn => {
      conn.setVisible(true);
    });
  }

  protected selectIed(ied: IED): void {
    this.deselectIed();

    if (!this.selectedIed) {
      this.selectedIed = ied;
      this.instance!.select().each(conn => {
        if (
          !(
            conn.source === this.element(ied.name) ||
            conn.target === this.element(ied.name)
          )
        )
          conn.setVisible(false);
      });
    } else if (this.selectedIed.name !== ied.name) {
      this.selectedIed = ied;

      this.instance!.select().each(conn => {
        if (
          !(
            conn.source === this.element(ied.name) ||
            conn.target === this.element(ied.name)
          )
        )
          conn.setVisible(false);
      });
    } else this.selectedIed = undefined;
  }

  protected updated(): void {
    if (this.instance) this.instance.setZoom(this.gridSize / defaultGridSize);
  }

  protected firstUpdated(): void {
    this.instance = newInstance({
      container: this.divRef,
      elementsDraggable: false,
    });

    this.instance.bind(EVENT_DRAG_STOP, p => {
      const iedName = p.elements[0].el.id;
      const ied = this.doc.querySelector(`:root > IED[name="${iedName}"]`)!;
      const newX = p.elements[0].pos.x / this.gridSize;
      const newY = p.elements[0].pos.y / this.gridSize;

      const updateX = {
        element: ied,
        attributes: {
          [`${nsp}:x`]: {
            namespaceURI: sldNs,
            value: `${newX}`,
          },
        },
      };

      const updateY = {
        element: ied,
        attributes: {
          [`${nsp}:y`]: {
            namespaceURI: sldNs,
            value: `${newY}`,
          },
        },
      };

      this.dispatchEvent(newEditEvent([updateX, updateY]));
    });

    this.links.forEach(link => {
      this.instance!.connect({
        source: this.element(link.source),
        target: this.element(link.sink),
        anchor: 'ContinuousTopBottom',
        connector: {
          type: FlowchartConnector.type,
          options: { cornerRadius: 4 },
        },
        detachable: false,
        endpoints: [
          { type: 'Dot', options: { radius: 4 } },
          { type: 'Dot', options: { radius: 4 } },
        ],
        endpointStyles: [
          { fill: link.type ? connColor[link.type] : 'black' },
          { fill: 'white', stroke: 'black' },
        ],
        overlays: [
          {
            type: 'Arrow',
            options: { location: 1, width: 10, length: 10 },
          },
        ],
        lineWidth: 3,
        color: link.type ? connColor[link.type] : 'black',
        hoverClass: 'connector-hover',
      });
    });
  }

  coordinate(ied: IED, type: 'x' | 'y' | 'labelx' | 'labely'): string {
    if (type === 'x')
      return `${ied.x ? ied.x * this.gridSize : this.gridSize}px`;
    if (type === 'y')
      return `${ied.y ? ied.y * this.gridSize : this.gridSize}px`;
    if (type === 'labelx')
      return `${
        ied.x && ied.labelx
          ? (ied.labelx - ied.x) * this.gridSize
          : this.gridSize
      }px`;

    return `${
      ied.y && ied.labely ? (ied.labely - ied.y) * this.gridSize : this.gridSize
    }px`;
  }

  // eslint-disable-next-line class-methods-use-this
  renderIED(ied: IED): TemplateResult {
    // eslint-disable-next-line lit-a11y/click-events-have-key-events
    return html`<div
      draggable="false"
      id="${ied.name}"
      style="position: absolute; width: ${this.gridSize}px; height: ${this
        .gridSize}px; left: ${this.coordinate(
        ied,
        'x'
      )}; top: ${this.coordinate(ied, 'y')}"
      @click="${(evt: Event) => {
        this.selectIed(ied);
        evt.stopPropagation();
      }}"
    >
      <label
        style="position:absolute; left:${this.coordinate(
          ied,
          'labelx'
        )}; top:${this.coordinate(ied, 'labely')};"
        >${ied.name}</label
      >
      <mwc-icon style="--mdc-icon-size: ${this.gridSize}px;"
        >developer_board</mwc-icon
      >
    </div>`;
  }

  render() {
    // eslint-disable-next-line lit-a11y/click-events-have-key-events
    return html`<div id="container">
      ${this.ieds.map(ied => this.renderIED(ied))}
    </div>`;
  }

  static styles = css`
    #container {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    .bayContainer {
      display: flex;
    }

    .connector-hover > path {
      stroke: #b58900;
      stroke-width: 6;
    }

    .connector-hover {
      z-index: 10;
    }
  `;
}
