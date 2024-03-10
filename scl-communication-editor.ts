/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */
import { css, html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import '@material/mwc-checkbox';
import '@material/mwc-formfield';
import '@material/mwc-fab';
import '@material/mwc-icon-button';

import { find } from '@openenergytools/scl-lib';

import './sld-communication.js';
import './editors/data-set-element-editor.js';
import './editors/gse-control-element-editor.js';
import './editors/report-control-element-editor.js';
import './editors/sampled-value-control-element-editor.js';
import type { DataSetElementEditor } from './editors/data-set-element-editor.js';
import type { GseControlElementEditor } from './editors/gse-control-element-editor.js';
import type { ReportControlElementEditor } from './editors/report-control-element-editor.js';
import type { SampledValueControlElementEditor } from './editors/sampled-value-control-element-editor.js';

export type ConnectClick = {
  tag: string;
  id: string;
};

export type ConnectedClickEvent = CustomEvent<ConnectClick>;

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

  @query('.sidebar.left') leftSidebar!: HTMLDivElement;

  @query('report-control-element-editor')
  reportEditor!: ReportControlElementEditor;

  @query('gse-control-element-editor')
  gseControlEditor!: GseControlElementEditor;

  @query('sampled-value-control-element-editor')
  smvControlEditor!: SampledValueControlElementEditor;

  @query('data-set-element-editor')
  dataSetEditor!: DataSetElementEditor;

  setSmvControl(id: string): void {
    const smvControl = find(this.doc, 'SampledValueControl', id);

    if (smvControl) {
      this.smvControlEditor.element = smvControl;
      const dataSet =
        smvControl.parentElement?.querySelector(
          `DataSet[name="${smvControl.getAttribute('datSet')}"]`
        ) ?? null;
      this.dataSetEditor.element = dataSet;
    } else {
      this.smvControlEditor.element = null;
      this.dataSetEditor.element = null;
    }
    this.reportEditor.classList.add('hide');
    this.gseControlEditor.classList.add('hide');
    this.smvControlEditor.classList.remove('hide');
    this.leftSidebar.classList.remove('is-closed');
  }

  setGseControl(id: string): void {
    const gseControl = find(this.doc, 'GSEControl', id);

    if (gseControl) {
      this.gseControlEditor.element = gseControl;
      const dataSet =
        gseControl.parentElement?.querySelector(
          `DataSet[name="${gseControl.getAttribute('datSet')}"]`
        ) ?? null;
      this.dataSetEditor.element = dataSet;
    } else {
      this.gseControlEditor.element = null;
      this.dataSetEditor.element = null;
    }
    this.reportEditor.classList.add('hide');
    this.gseControlEditor.classList.remove('hide');
    this.smvControlEditor.classList.add('hide');
    this.leftSidebar.classList.remove('is-closed');
  }

  setReport(id: string): void {
    const report = find(this.doc, 'ReportControl', id);

    if (report) {
      this.reportEditor.element = report;
      const dataSet =
        report.parentElement?.querySelector(
          `DataSet[name="${report.getAttribute('datSet')}"]`
        ) ?? null;
      this.dataSetEditor.element = dataSet;
    } else {
      this.reportEditor.element = undefined;
      this.dataSetEditor.element = null;
    }
    this.reportEditor.classList.remove('hide');
    this.gseControlEditor.classList.add('hide');
    this.smvControlEditor.classList.add('hide');
    this.leftSidebar.classList.remove('is-closed');
  }

  render() {
    if (!this.doc) return html``;

    return html` <div class="service-selector">
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
      <div class="sidebar left is-closed">
        <mwc-icon-button
          icon="close"
          @click="${() => this.leftSidebar.classList.add('is-closed')}"
        ></mwc-icon-button>
        <report-control-element-editor
          .editCount=${this.editCount}
        ></report-control-element-editor>
        <gse-control-element-editor
          .editCount=${this.editCount}
        ></gse-control-element-editor>
        <sampled-value-control-element-editor
          .editCount=${this.editCount}
        ></sampled-value-control-element-editor>
        <data-set-element-editor
          .editCount=${this.editCount}
        ></data-set-element-editor>
      </div>
      <sld-communication
        .doc=${this.doc}
        .gridSize=${this.gridSize}
        .report=${this.report}
        .goose=${this.goose}
        .smv=${this.smv}
        @connection-click="${(evt: ConnectedClickEvent) => {
          if (evt.detail.tag === 'ReportControl') this.setReport(evt.detail.id);
          if (evt.detail.tag === 'GSEControl')
            this.setGseControl(evt.detail.id);
          if (evt.detail.tag === 'SampledValueControl')
            this.setSmvControl(evt.detail.id);
        }}"
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

    .hide {
      display: none;
    }

    .sidebar.left {
      position: absolute;
      padding: 5px;
      top: 0;
      left: 0;
      width: 500px;
      height: 100vh;
      background-color: white;
      border: 3px black solid;
      transition: 0.7s;
      z-index: 9;
      overflow-y: scroll;

      &.is-closed {
        transform: translateX(-516px);
      }
    }
  `;
}
