/* eslint-disable @typescript-eslint/no-unused-vars */
import { css, html, nothing, LitElement, svg, TemplateResult } from 'lit';
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';

import { Edit, newEditEvent } from '@openscd/open-scd-core';

import type { Dialog } from '@material/mwc-dialog';
import type { SingleSelectedEvent } from '@material/mwc-list';
import type { Snackbar } from '@material/mwc-snackbar';
import type { TextField } from '@material/mwc-textfield';

import '@material/mwc-dialog';
import '@material/mwc-list';
import '@material/mwc-list/mwc-list-item.js';
import '@material/mwc-snackbar';
import '@material/mwc-textfield';

import { identity } from '@openenergytools/scl-lib';
import { eqRingPath, symbols, zigZag2WTransform, zigZagPath } from './icons.js';
import {
  attributes,
  hasIedCoordinates,
  isBusBar,
  isEqType,
  Point,
  privType,
  ringedEqTypes,
  robotoDataURL,
  sldNs,
  svgNs,
  xlinkNs,
  xmlBoolean,
} from './util.js';

const parentTags: Partial<Record<string, string[]>> = {
  ConductingEquipment: ['Bay'],
  Bay: ['VoltageLevel'],
  VoltageLevel: ['Substation'],
  PowerTransformer: ['Bay', 'VoltageLevel', 'Substation'],
  IED: ['Bay', 'VoltageLevel', 'Substation'],
};

function isBay(element: Element) {
  return element.tagName === 'Bay' && !isBusBar(element);
}

@customElement('sld-editor-2')
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export class SLDEditor2 extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  @property({ attribute: false })
  substation!: Element;

  @property({ type: Number })
  editCount = -1;

  @property({ type: Number })
  gridSize = 32;

  @property({ type: Boolean })
  showLabels: boolean = false;

  @query('svg#sld')
  sld!: SVGGraphicsElement;

  // eslint-disable-next-line class-methods-use-this
  renderedLabelPosition(element: Element): Point {
    const {
      label: [x, y],
    } = attributes(element);

    return [x, y];
  }

  // eslint-disable-next-line class-methods-use-this
  renderedPosition(element: Element): Point {
    const {
      pos: [x, y],
    } = attributes(element);

    return [x, y];
  }

  render() {
    const {
      dim: [w, h],
    } = attributes(this.substation);

    return html`<section>
      <svg
        xmlns="${svgNs}"
        xmlns:xlink="${xlinkNs}"
        id="sld"
        viewBox="0 0 ${w} ${h}"
        width="${w * this.gridSize}"
        height="${h * this.gridSize}"
        stroke-width="0.06"
        fill="none"
      >
        <style>
          @font-face {
            font-family: 'Roboto';
            font-style: normal;
            font-weight: 400;
            src: url(${robotoDataURL}) format('woff');
          }
          .handle {
            visibility: hidden;
          }
          :focus {
            outline: none;
          }
          g:hover > .handle {
            opacity: 0.2;
            visibility: visible;
          }
          g:hover > .handle:hover {
            visibility: visible;
            opacity: 0.83;
          }
          g.voltagelevel > rect,
          g.bay > rect {
            shape-rendering: crispEdges;
          }
          svg:not(:hover) .preview {
            visibility: hidden;
          }
          .preview {
            opacity: 0.75;
          }
        </style>
        ${symbols}
        <rect width="100%" height="100%" fill="white" />
        ${Array.from(this.substation.children)
          .filter(child => child.tagName === 'VoltageLevel')
          .map(vl => svg`${this.renderContainer(vl)}`)}
        ${Array.from(this.substation.querySelectorAll('ConnectivityNode'))
          .filter(
            node =>
              node.getAttribute('name') !== 'grounded' &&
              !isBusBar(node.parentElement!)
          )
          .map(cNode => this.renderConnectivityNode(cNode))}
        ${Array.from(this.substation.querySelectorAll('ConnectivityNode'))
          .filter(
            node =>
              node.getAttribute('name') !== 'grounded' &&
              isBusBar(node.parentElement!)
          )
          .map(cNode => this.renderConnectivityNode(cNode))}
        ${Array.from(
          this.substation.querySelectorAll(':scope > PowerTransformer')
        ).map(transformer => this.renderPowerTransformer(transformer))}
        ${Array.from(this.doc.querySelectorAll(':root > IED'))
          .filter(child => child.tagName === 'IED' && hasIedCoordinates(child))
          .map(ied => this.renderIed(ied))}
        ${Array.from(this.doc.querySelectorAll(':root > IED'))
          .filter(child => child.tagName === 'IED' && hasIedCoordinates(child))
          .map(ied => this.renderLabel(ied))}
        ${Array.from(
          this.substation.querySelectorAll(
            'VoltageLevel, Bay, ConductingEquipment, PowerTransformer, Text, ine'
          )
        ).map(element => this.renderLabel(element))}
      </svg>
    </section>`;
  }

  renderLabel(element: Element) {
    if (!this.showLabels) return nothing;

    let deg = 0;
    let text: string | null | TemplateResult<2>[] =
      element.getAttribute('name');
    let weight = 400;
    let color = 'black';
    const [x, y] = this.renderedLabelPosition(element);

    if (element.tagName === 'Text') {
      ({ weight, color } = attributes(element));
      deg = attributes(element).rot * 90;
      if (element.textContent)
        text = element.textContent?.split(/\r?\n/).map(
          (line, i) =>
            svg`<tspan alignment-baseline="central"
                  x="${x + 0.1}" dy="${i === 0 ? nothing : '1.19em'}"
                  visibility="${line ? nothing : 'hidden'}">
                  ${line || '.'}
                </tspan>`
        );
      else {
        text = '<Middle click to edit>';
        color = '#aaa';
        weight = 500;
      }
    }

    const fontSize =
      element.tagName === 'ConductingEquipment' || element.tagName === 'IED'
        ? 0.45
        : 0.6;

    const id =
      element.closest('Substation') === this.substation &&
      element.tagName !== 'Text'
        ? identity(element)
        : nothing;
    const classes = classMap({
      label: true,
      container:
        (element.tagName === 'Bay' && !isBusBar(element)) ||
        element.tagName === 'VoltageLevel',
      ied: element.tagName === 'IED',
      equipment: element.tagName === 'ConductingEquipment',
    });
    return svg`<g class="${classes}" id="label:${id}"
                 transform="rotate(${deg} ${x + 0.5} ${y - 0.5})">
        <text x="${x + 0.1}" y="${y - 0.5}"
          alignment-baseline="central"
          fill="${color}" font-weight="${weight}"
          font-size="${fontSize}px" font-family="Roboto, sans-serif"
          style="cursor: default;">
          ${text}
        </text>
      </g>`;
  }

  renderContainer(bayOrVL: Element): TemplateResult<2> {
    const isVL = bayOrVL.tagName === 'VoltageLevel';

    const [x, y] = this.renderedPosition(bayOrVL);
    const {
      dim: [w, h],
    } = attributes(bayOrVL);

    return svg`<g id="${
      bayOrVL.closest('Substation') === this.substation
        ? identity(bayOrVL)
        : nothing
    }" class=${classMap({
      voltagelevel: isVL,
      bay: !isVL,
    })} tabindex="0" style="outline: none;">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke-dasharray="${
      isVL ? nothing : '0.18'
    }"
        stroke="${isVL ? '#F5E214' : '#12579B'}" />
      ${Array.from(bayOrVL.children)
        .filter(isBay)
        .map(bay => this.renderContainer(bay))}
      ${Array.from(bayOrVL.children)
        .filter(child => child.tagName === 'ConductingEquipment')
        .map(equipment => this.renderEquipment(equipment))}
      ${Array.from(bayOrVL.children)
        .filter(child => child.tagName === 'PowerTransformer')
        .map(equipment => this.renderPowerTransformer(equipment))}
      </g>`;
  }

  windingMeasures(winding: Element): {
    center: Point;
    size: number;
    terminals: Partial<Record<'T1' | 'T2' | 'N1' | 'N2', Point>>;
    grounded: Partial<Record<'N1' | 'N2', [Point, Point]>>;
    arc?: {
      from: Point;
      fromCtl: Point;
      to: Point;
      toCtl: Point;
    };
    zigZagTransform?: string;
  } {
    const transformer = winding.parentElement!;
    const windings = Array.from(transformer.children).filter(
      c => c.tagName === 'TransformerWinding'
    );
    const [x, y] = this.renderedPosition(transformer).map(c => c + 0.5);
    let center = [x, y] as Point;
    const size = 0.7;
    const grounded: Partial<Record<'N1' | 'N2', [Point, Point]>> = {};
    const terminals: Partial<Record<'T1' | 'T2' | 'N1' | 'N2', Point>> = {};
    let arc:
      | {
          from: Point;
          fromCtl: Point;
          to: Point;
          toCtl: Point;
        }
      | undefined;
    let zigZagTransform: string | undefined;
    const terminalElements = Array.from(winding.children).filter(
      c => c.tagName === 'Terminal'
    );
    const terminal1 = terminalElements.find(
      t => t.getAttribute('name') === 'T1'
    );
    const terminal2 = terminalElements.find(
      t => t.getAttribute('name') !== 'T1'
    );
    const neutral = Array.from(winding.children).find(
      c => c.tagName === 'NeutralPoint'
    );
    const windingIndex = windings.indexOf(winding);
    const { rot, kind, flip } = attributes(transformer);
    function shift(point: Point, coord: 0 | 1, amount: number) {
      const shifted = point.slice() as Point;
      if (coord === 0) shifted[rot % 2] += rot < 2 ? amount : -amount;
      else shifted[(rot + 1) % 2] += rot > 0 && rot < 3 ? -amount : amount;
      return shifted;
    }
    if (windings.length === 1) {
      if (kind === 'earthing') {
        zigZagTransform = '';
        const n1 = shift(center, 1, size);
        if (!neutral) {
          terminals.N1 = n1;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          const n1p = shift(n1, 1, 0.2);
          grounded.N1 = [n1p, n1];
        }
        if (!terminal1 && !terminal2) {
          terminals.T1 = shift(center, 1, -size);
        }
      } else {
        const sgn = flip ? -1 : 1;
        const n1 = shift(center, 0, -size);
        const n2 = shift(center, 0, size);
        const t1 = shift(center, 1, (-size - 0.5) * sgn);
        const t2 = shift(center, 1, size * sgn);
        if (!neutral) {
          terminals.N1 = n1;
          terminals.N2 = n2;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          if (neutral.getAttribute('name') === 'N1') {
            const n1p = shift(n1, 0, -0.2);
            grounded.N1 = [n1p, n1];
          } else {
            const n2p = shift(n2, 0, 0.2);
            grounded.N2 = [n2p, n2];
          }
        }
        arc = {
          from: n2,
          fromCtl: shift(n2, 1, -sgn),
          to: t1,
          toCtl: shift(shift(t1, 0, 0.2), 1, 0.1 * sgn),
        };
        if (!terminal1) {
          terminals.T1 = t1;
        }
        if (!terminal2) {
          terminals.T2 = t2;
        }
      }
    } else if (windings.length === 2) {
      if (windingIndex === 1) {
        center = shift(center, 1, 1);
      }
      if (kind === 'auto') {
        if (windingIndex === 1) {
          const n1 = shift(center, 0, -size);
          const n2 = shift(center, 0, size);
          if (!neutral) {
            terminals.N1 = n1;
            terminals.N2 = n2;
          } else if (neutral.getAttribute('cNodeName') === 'grounded') {
            if (neutral.getAttribute('name') === 'N1') {
              const n1p = shift(n1, 0, -0.2);
              grounded.N1 = [n1p, n1];
            } else {
              const n2p = shift(n2, 0, 0.2);
              grounded.N2 = [n2p, n2];
            }
          }
          if (!terminal1 && !terminal2) {
            terminals.T1 = shift(center, 1, size);
          }
        } else {
          const sgn = flip ? -1 : 1;
          const t1 = shift(center, 0, size * sgn);
          const t2 = shift(center, 0, (-size - 0.5) * sgn);
          const n1 = shift(center, 1, -size);
          arc = {
            from: n1,
            fromCtl: shift(n1, 0, -sgn),
            to: t2,
            toCtl: shift(shift(t2, 1, -0.2), 0, 0.1 * sgn),
          };
          if (!terminal1) terminals.T1 = t1;
          if (!terminal2) terminals.T2 = t2;
          if (!neutral) {
            terminals.N1 = n1;
          } else if (neutral.getAttribute('cNodeName') === 'grounded') {
            const n1p = shift(n1, 1, -0.2);
            grounded.N1 = [n1p, n1];
          }
        }
      } else if (kind === 'earthing') {
        if (windingIndex === 1) {
          if (!terminal1 && !terminal2) {
            terminals.T1 = shift(center, 1, size);
          }
        } else {
          zigZagTransform = zigZag2WTransform;
          const sgn = flip ? -1 : 1;
          if (!terminal1 && !terminal2)
            terminals.T1 = shift(center, 0, -size * sgn);
          const n1 = shift(center, 0, size * sgn);
          if (!neutral) {
            terminals.N1 = n1;
          } else if (neutral.getAttribute('cNodeName') === 'grounded') {
            const n1p = shift(n1, 0, 0.2 * sgn);
            grounded.N1 = [n1p, n1];
          }
        }
      } else if (windingIndex === 1) {
        const n1 = shift(center, 0, -size);
        const n2 = shift(center, 0, +size);

        if (!neutral) {
          terminals.N1 = n1;
          terminals.N2 = n2;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          if (neutral.getAttribute('name') === 'N1') {
            const n1p = shift(n1, 0, -0.2);
            grounded.N1 = [n1p, n1];
          } else {
            const n2p = shift(n2, 0, 0.2);
            grounded.N2 = [n2p, n2];
          }
        }
        if (!terminal1 && !terminal2) {
          terminals.T1 = shift(center, 1, +size);
        }
      } else {
        const n1 = shift(center, 0, -size);
        const n2 = shift(center, 0, +size);

        if (!neutral) {
          terminals.N1 = n1;
          terminals.N2 = n2;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          if (neutral.getAttribute('name') === 'N1') {
            const n1p = shift(n1, 0, -0.2);
            grounded.N1 = [n1p, n1];
          } else {
            const n2p = shift(n2, 0, 0.2);
            grounded.N2 = [n2p, n2];
          }
        }
        if (!terminal1 && !terminal2) {
          terminals.T1 = shift(center, 1, -size);
        }
      }
    } else if (windings.length === 3) {
      if (windingIndex === 0) {
        if (!terminal1 && !terminal2) {
          terminals.T1 = shift(center, 1, -size);
        }
        const n1 = shift(center, 0, -size);
        const n2 = shift(center, 0, +size);
        if (!neutral) {
          terminals.N1 = n1;
          terminals.N2 = n2;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          if (neutral.getAttribute('name') === 'N1') {
            const n1p = shift(n1, 0, -0.2);
            grounded.N1 = [n1p, n1];
          } else {
            const n2p = shift(n2, 0, 0.2);
            grounded.N2 = [n2p, n2];
          }
        }
      } else if (windingIndex === 1) {
        center = shift(shift(center, 0, 0.5), 1, 1);
        if (!terminal1 && !terminal2) {
          terminals.T1 = shift(center, 0, size);
        }
        const n1 = shift(center, 1, size);
        if (!neutral) {
          terminals.N1 = n1;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          const n1p = shift(n1, 1, 0.2);
          grounded.N1 = [n1p, n1];
        }
      } else if (windingIndex === 2) {
        center = shift(shift(center, 0, -0.5), 1, 1);
        if (!terminal1 && !terminal2) {
          terminals.T1 = shift(center, 0, -size);
        }
        const n1 = shift(center, 1, size);
        if (!neutral) {
          terminals.N1 = n1;
        } else if (neutral.getAttribute('cNodeName') === 'grounded') {
          const n1p = shift(n1, 1, 0.2);
          grounded.N1 = [n1p, n1];
        }
      }
    }
    return { center, size, terminals, grounded, arc, zigZagTransform };
  }

  renderTransformerWinding(winding: Element): TemplateResult<2> {
    const {
      size,
      center: [cx, cy],
      grounded,
      arc,
      zigZagTransform,
    } = this.windingMeasures(winding);
    const ports: TemplateResult<2>[] = [];
    Object.entries(grounded).forEach(([_, [[x1, y1], [x2, y2]]]) => {
      ports.push(
        svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="0.06" marker-start="url(#grounded)" />`
      );
    });

    let longArrow = false;
    let arcPath = svg``;
    const { flip, rot } = attributes(winding.parentElement!);
    if (arc) {
      const {
        from: [xf, yf],
        fromCtl: [xfc, yfc],
        to: [xt, yt],
        toCtl: [xtc, ytc],
      } = arc;
      if (!flip && yfc < yf) longArrow = true;
      if (flip && xfc > xf) longArrow = true;
      arcPath = svg`<path d="M ${xf} ${yf} C ${xfc} ${yfc}, ${xtc} ${ytc}, ${xt} ${yt}" stroke="black" stroke-width="0.06" />`;
    }
    const tapChanger = winding.querySelector('TapChanger');
    const ltcArrow = tapChanger
      ? svg`<line x1="${cx - 0.8}" y1="${cy + 0.8}" x2="${cx + 0.8}" y2="${
          cy - (longArrow ? 1 : 0.8)
        }"
              stroke="black" stroke-width="0.06" marker-end="url(#arrow)" />`
      : nothing;
    const zigZag =
      zigZagTransform === undefined
        ? nothing
        : svg`<g stroke="black" stroke-linecap="round"
                transform="rotate(${rot * 90} ${cx} ${cy})
                translate(${cx - 1.5} ${cy - 1.5})
                ${zigZagTransform}">${zigZagPath}</g>`;
    return svg`<g class="winding"><circle cx="${cx}" cy="${cy}" r="${size}" stroke="black" stroke-width="0.06" />${arcPath}${zigZag}${ltcArrow}${ports}</g>`;
  }

  renderPowerTransformer(transformer: Element): TemplateResult<2> {
    const windings = Array.from(transformer.children).filter(
      c => c.tagName === 'TransformerWinding'
    );
    const [x, y] = this.renderedPosition(transformer);

    return svg`<g class="${classMap({ transformer: true })}"
        pointer-events="all" >
        ${windings.map(w => this.renderTransformerWinding(w))}
      </g>`;
  }

  renderEquipment(equipment: Element) {
    const [x, y] = this.renderedPosition(equipment);
    const { flip, rot } = attributes(equipment);
    const deg = 90 * rot;

    const eqType = equipment.getAttribute('type')!;
    const ringed = ringedEqTypes.has(eqType);
    const symbol = isEqType(eqType) ? eqType : 'ConductingEquipment';
    const icon = ringed
      ? svg`<svg
    viewBox="0 0 25 25"
    width="1"
    height="1"
  >
    ${eqRingPath}
  </svg>`
      : svg`<use href="#${symbol}" xlink:href="#${symbol}"
              pointer-events="none" />`;

    const terminals = Array.from(equipment.children).filter(
      c => c.tagName === 'Terminal'
    );
    const topTerminal = terminals.find(t => t.getAttribute('name') === 'T1');
    const bottomTerminal = terminals.find(t => t.getAttribute('name') !== 'T1');

    const topGrounded =
      topTerminal?.getAttribute('cNodeName') === 'grounded'
        ? svg`<line x1="0.5" y1="-0.1" x2="0.5" y2="0.16" stroke="black"
                stroke-width="0.06" marker-start="url(#grounded)" />`
        : nothing;

    const bottomGrounded =
      bottomTerminal?.getAttribute('cNodeName') === 'grounded'
        ? svg`<line x1="0.5" y1="1.1" x2="0.5" y2="0.84" stroke="black"
                stroke-width="0.06" marker-start="url(#grounded)" />`
        : nothing;

    return svg`<g class="${classMap({ equipment: true })}"
    id="${
      equipment.closest('Substation') === this.substation
        ? identity(equipment)
        : nothing
    }"
    transform="translate(${x} ${y}) rotate(${deg} 0.5 0.5)${
      flip ? ' scale(-1,1) translate(-1 0)' : ''
    }">
      <title>${equipment.getAttribute('name')}</title>
      ${icon}
      ${
        ringed
          ? svg`<use transform="rotate(${-deg} 0.5 0.5)" pointer-events="none"
                  href="#${symbol}" xlink:href="#${symbol}" />`
          : nothing
      }
      <rect width="1" height="1" fill="none" />
      ${topGrounded}
      ${bottomGrounded}
    </g>`;
  }

  renderIed(ied: Element) {
    const [x, y] = this.renderedPosition(ied);

    const eqType = ied.getAttribute('type')!;
    const ringed = ringedEqTypes.has(eqType);
    const symbol = 'IED';
    const icon = svg`<use href="#${symbol}" xlink:href="#${symbol}"
              pointer-events="none" />`;

    return svg`<g class="ied"
    id="${identity(ied)}"
    transform="translate(${x} ${y})">
      <title>${ied.getAttribute('name')}</title>
      ${icon}
      <rect width="1" height="1" fill="none" />
    </g>`;
  }

  renderBusBar(busBar: Element) {
    const [x, y] = this.renderedPosition(busBar);
    const {
      dim: [w, h],
    } = attributes(busBar);

    return svg`<g class="bus preview" id="${
      busBar.closest('Substation') === this.substation
        ? identity(busBar)
        : nothing
    }">
      <title>${busBar.getAttribute('name')}</title>
      ${this.renderLabel(busBar)}
      ${Array.from(busBar.querySelectorAll('Text')).map(text =>
        this.renderLabel(text)
      )}
      ${this.renderConnectivityNode(busBar.querySelector('ConnectivityNode')!)}
    </g>`;
  }

  renderConnectivityNode(cNode: Element) {
    const priv = cNode.querySelector(`Private[type="${privType}"]`);
    if (!priv) return nothing;
    const circles = [] as TemplateResult<2>[];
    const intersections = Object.entries(
      Array.from(priv.querySelectorAll('Vertex')).reduce((record, vertex) => {
        const ret = record;
        const key = JSON.stringify(this.renderedPosition(vertex));
        if (ret[key]) ret[key].push(vertex);
        else ret[key] = [vertex];
        return ret;
      }, {} as Record<string, Element[]>)
    )
      .filter(
        ([_, vertices]) =>
          vertices.length > 2 ||
          (vertices.length === 2 &&
            vertices.find(v => v.hasAttributeNS(sldNs, 'uuid')))
      )
      .map(([_, [vertex]]) => this.renderedPosition(vertex));
    intersections.forEach(([x, y]) =>
      circles.push(svg`<circle fill="black" cx="${x}" cy="${y}" r="0.15" />`)
    );
    const lines = [] as TemplateResult<2>[];
    const sections = Array.from(priv.getElementsByTagNameNS(sldNs, 'Section'));
    const bay = cNode.closest('Bay');
    const targetSize = 0.5;
    sections.forEach(section => {
      const busBar = xmlBoolean(section.getAttribute('bus'));
      const vertices = Array.from(
        section.getElementsByTagNameNS(sldNs, 'Vertex')
      );
      let i = 0;
      while (i < vertices.length - 1) {
        const [x1, y1] = this.renderedPosition(vertices[i]);
        const [x2, y2] = this.renderedPosition(vertices[i + 1]);
        if (busBar && bay) {
          const {
            pos: [x, y],
          } = attributes(bay);
        }

        lines.push(
          svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke-width="${busBar ? 0.12 : nothing}" stroke="black" 
                stroke-linecap="${busBar ? 'round' : 'square'}" />`
        );
        lines.push(
          svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${targetSize}" />`
        );

        i += 1;
      }
    });
    const id =
      cNode.closest('Substation') === this.substation
        ? identity(cNode)
        : nothing;
    return svg`<g class="node" id="${id}" >
        <title>${cNode.getAttribute('pathName')}</title>
        ${circles}
        ${lines}
      </g>`;
  }

  static styles = css`
    h2 {
      font-family: Roboto;
      font-weight: 300;
      font-size: 24px;
      margin-bottom: 4px;
      color: rgba(0, 0, 0, 0.83);
      --mdc-icon-button-size: 28px;
      --mdc-icon-size: 24px;
    }

    .hidden {
      display: none;
    }
    svg:not(:hover) ~ .coordinates {
      display: none;
    }

    * {
      user-select: none;
    }
  `;
}
