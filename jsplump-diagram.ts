/* eslint-disable no-return-assign */
import {
  css,
  html,
  LitElement,
  svg,
  SVGTemplateResult,
  TemplateResult,
} from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

// eslint-disable-next-line import/no-extraneous-dependencies
import {
  newInstance,
  FlowchartConnector,
  StraightConnector,
  BrowserJsPlumbInstance,
  EVENT_DRAG_STOP,
} from '@jsplumb/browser-ui';
import { newEditEvent } from '@openscd/open-scd-core';
import { identity } from '@openenergytools/scl-lib';

const connColor: Record<string, string> = {
  Report: '#268bd2',
  SMV: '#d33682',
  GOOSE: '#2aa198',
  Equipment: 'grey',
};

export interface GridObject {
  name: string;
  x?: number;
  y?: number;
  iedName?: string;
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

function makeId(id: string): string {
  return `${id}`.replace(/[- >]/g, '_');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseEquipment(doc: XMLDocument): Link[] {
  const uniqueItems: string[] = [];
  return Array.from(
    doc.querySelectorAll('ConductingEquipment LNode, PowerTransformer LNode')
  )
    .filter(lNode => lNode.getAttribute('iedName'))
    .map(lNode => {
      const equipment = lNode.closest('ConductingEquipment, PowerTransformer')!;
      return {
        source: makeId(`${identity(equipment)}`),
        sink: makeId(lNode.getAttribute('iedName')!),
        type: 'Equipment',
      };
    })
    .filter(ce => {
      const alreadyExisting = !uniqueItems.includes(ce.source);
      uniqueItems.push(ce.source);
      return alreadyExisting;
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
  get equipments(): GridObject[] {
    const uniqueItems: string[] = [];
    return Array.from(
      this.doc.querySelectorAll(
        'ConductingEquipment LNode, PowerTransformer LNode'
      )
    )
      .filter(lNode => lNode.getAttribute('iedName'))
      .map(lNode => {
        const equipment = lNode.closest(
          'ConductingEquipment, PowerTransformer'
        )!;
        return {
          name: makeId(`${identity(equipment)}`),
          x: parseInt(equipment.getAttribute('esld:x') ?? '10', 10),
          y: parseInt(equipment.getAttribute('esld:y') ?? '10', 10),
          iedName: lNode.getAttribute('iedName') ?? 'Unknown',
        };
      })
      .filter(equip => {
        const alreadyExisting = !uniqueItems.includes(equip.name);
        uniqueItems.push(equip.name);
        return alreadyExisting;
      });
  }

  @state()
  get ieds(): GridObject[] {
    return Array.from(this.doc.querySelectorAll(':root > IED')).map(ied => {
      // use existing coordinates if present
      if (ied.getAttribute('esld:x'))
        return {
          name: ied.getAttribute('name')!,
          x: parseInt(
            ied?.getAttribute('esld:x') ?? (Math.random() * 10).toString(),
            10
          ),
          y: parseInt(
            ied?.getAttribute('esld:y') ?? (Math.random() * 10).toString(),
            10
          ),
        };

      //  else use coordinates from the substatin section
      const nearestLNode = this.doc.querySelector(
        `LNode[iedName="${ied.getAttribute('name')}"]`
      );
      const nearestCoordinates = nearestLNode
        ? nearestLNode.closest(
            'Substation,VoltageLevel,Bay,ConductingEquipment,PowerTransformer'
          )
        : undefined;
      return {
        name: ied.getAttribute('name')!,
        x: parseInt(
          nearestCoordinates?.getAttribute('esld:x') ??
            (Math.random() * 10).toString(),
          10
        ),
        y: parseInt(
          nearestCoordinates?.getAttribute('esld:y') ??
            (Math.random() * 10).toString(),
          10
        ),
      };
    });
  }

  @state()
  get links(): Link[] {
    return [...parseExtRefs(this.doc), ...parseClientLns(this.doc)];

    // Removed to avoid equipment lines
    // ...parseEquipment(this.doc),
  }

  instance?: BrowserJsPlumbInstance;

  @state()
  latestX: number = 32;

  @query(`#container`) divRef!: HTMLDivElement;

  private element(id: string): Element {
    return this.divRef.querySelector(`#${id}`)!;
  }

  protected selectIed(ied: string): void {
    Array.from(this.divRef.querySelectorAll('.lnode')!).forEach(member => {
      if (member.classList.contains(ied)) {
        member.classList.add('animate');
      } else {
        member.classList.remove('animate');
      }
    });

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
      // console.log(link.sink);
      this.instance!.connect({
        source: this.element(link.source),
        target: this.element(link.sink),
        // ideally would use object rotation to define these to avoid equipment overlaps
        anchor:
          link.type === 'Equipment'
            ? 'ContinuousLeftRight'
            : 'ContinuousTopBottom',
        connector: {
          type:
            link.type === 'Equipment'
              ? StraightConnector.type
              : FlowchartConnector.type,
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
  renderIED(ied: GridObject): TemplateResult {
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

  // eslint-disable-next-line class-methods-use-this
  renderEquipment(equip: GridObject): SVGTemplateResult {
    return svg`<rect
      id="${equip.name}"
      class="lnode ${equip.iedName}"
      x="${equip.x! * this.gridSize - this.gridSize * 0}px"
      y="${equip.y! * this.gridSize + this.gridSize * 1.6}px"
      height="${this.gridSize}px" width="${
      this.gridSize
    }px" stroke-linecap="round" stroke-width="2" stroke-dasharray="2,3,5" fill="none" stroke="DodgerBlue"
      />`;
  }

  render() {
    return html`<div id="container">
      <svg
        id="container2"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 2240 1600"
        width="2240"
        height="1600"
      >
        ${this.equipments.map(equip => this.renderEquipment(equip))}
      </svg>
      ${this.ieds.map(ied => this.renderIED(ied))}
    </div>`;
  }

  static styles = css`
    #container {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    #container2 {
      position: absolute;
      left: 0;
      top: 0;
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

    .lnode {
      stroke-dasharray: 8;
    }

    .animate {
      animation: dash 30s linear infinite;
    }

    @keyframes dash {
      to {
        stroke-dashoffset: 1000;
      }
    }
  `;
}
