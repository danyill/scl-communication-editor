/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */
import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import '@material/mwc-checkbox';
import '@material/mwc-formfield';
import '@material/mwc-fab';

import './sld-communication.js';
import './sld-editor.js';

export default class SclCommunicationEditor extends LitElement {
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

  @state()
  private report = true;

  @state()
  private goose = true;

  @state()
  private smv = true;

  render() {
    if (!this.doc) return html``;

    return html`<div class="service-selector">
        <mwc-formfield label="Report"
          ><mwc-checkbox
            value="Report"
            ?checked=${this.report}
            eslint-disable-next-line
            no-return-assign
            @change=${() => {
              this.report = !this.report;
            }}
          ></mwc-checkbox></mwc-formfield
        ><mwc-formfield label="GOOSE"
          ><mwc-checkbox
            value="GOOSE"
            ?checked=${this.goose}
            @change=${() => {
              this.goose = !this.goose;
            }}
          ></mwc-checkbox></mwc-formfield
        ><mwc-formfield label="SampledValue"
          ><mwc-checkbox
            value="SampledValue"
            ?checked=${this.smv}
            @change=${() => {
              this.smv = !this.smv;
            }}
          ></mwc-checkbox
        ></mwc-formfield>
      </div>
      <sld-editor
        .doc=${this.doc}
        .substation=${this.doc.querySelector('Substation')!}
        .gridSize=${this.gridSize}
      ></sld-editor>
      <sld-communication
        .doc=${this.doc}
        .gridSize=${this.gridSize}
        .report=${this.report}
        .goose=${this.goose}
        .smv=${this.smv}
      ></sld-communication>
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

    sld-communication {
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
