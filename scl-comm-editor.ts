/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */
import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import '@material/mwc-fab';

import './jsplump-diagram.js';
import './sld-editor.js';

export default class SclCommEditor extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = -1;

  @state()
  gridSize = 32;

  zoomIn() {
    this.gridSize += 3;
  }

  zoomOut() {
    this.gridSize -= 3;
    if (this.gridSize < 2) this.gridSize = 2;
  }

  render() {
    if (!this.doc) return html``;

    return html`<div style="width:100%; height:100px;"></div>
      <sld-editor
        .doc=${this.doc}
        .substation=${this.doc.querySelector('Substation')!}
        .gridSize=${this.gridSize}
      ></sld-editor>
      <jsplump-diagram
        .doc=${this.doc}
        .gridSize=${this.gridSize}
      ></jsplump-diagram>
      <mwc-fab
        icon="zoom_in"
        label="Zoom In"
        title="Zoom In (${Math.round((100 * (this.gridSize + 3)) / 32)}%)"
        @click=${() => this.zoomIn()}
      >
      </mwc-fab
      ><mwc-fab
        icon="zoom_out"
        label="Zoom Out"
        ?disabled=${this.gridSize < 4}
        title="Zoom Out (${Math.round((100 * (this.gridSize - 3)) / 32)}%)"
        @click=${() => this.zoomOut()}
      ></mwc-fab>`;
  }

  static styles = css`
    sld-editor {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0.2;
    }

    jsplump-diagram {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    mwc-fab {
      position: fixed;
      bottom: 50px;
    }

    mwc-fab[icon='zoom_out'] {
      left: 50px;
    }

    mwc-fab[icon='zoom_in'] {
      left: 120px;
    }
  `;
}
