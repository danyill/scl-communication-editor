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

@customElement('jsplump-diagram')
export default class JsPlumpDiagram extends LitElement {
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
      x: parseInt(ied.getAttribute('esld:x')!, 10),
      y: parseInt(ied.getAttribute('esld:y')!, 10),
    }));
  }

  @state()
  get links(): Link[] {
    return [...parseExtRefs(this.doc), ...parseClientLns(this.doc)];
  }

  instance?: BrowserJsPlumbInstance;

  @state()
  latestX: number = 32;

  @query(`#container`) divRef!: HTMLDivElement;

  private element(id: string): Element {
    return this.divRef.querySelector(`#${id}`)!;
  }

  protected selectIed(ied: string): void {
    this.instance!.select().each(conn => {
      conn.setVisible(true);
    });
    this.instance!.select().each(conn => {
      if (
        !(
          conn.source === this.element(ied) || conn.target === this.element(ied)
        )
      )
        conn.setVisible(false);
    });
  }

  protected updated(): void {
    if (this.instance) this.instance.setZoom(this.gridSize / defaultGridSize);
  }

  protected firstUpdated(): void {
    this.instance = newInstance({
      container: this.divRef,
      dragOptions: {
        grid: { w: 25, h: 25 },
      },
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

  // eslint-disable-next-line class-methods-use-this
  renderIED(ied: IED): TemplateResult {
    this.latestX += this.gridSize;

    // eslint-disable-next-line lit-a11y/click-events-have-key-events
    return html`<div
      id="${ied.name}"
      @click="${() => this.selectIed(ied.name)}"
    >
      <style>
        #${ied.name} {
          position: absolute;
          width: ${this.gridSize}px;
          height: ${this.gridSize}px;
          left: ${ied.x ? ied.x * this.gridSize : this.gridSize}px;
          top: ${ied.y ? ied.y * this.gridSize : this.gridSize}px;
        }
      </style>
      <label style="position:absolute;">${ied.name}</label>
      <mwc-icon style="--mdc-icon-size: ${this.gridSize}px;"
        >developer_board</mwc-icon
      >
    </div>`;
  }

  render() {
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
