import { LitElement } from 'lit';
import { BrowserJsPlumbInstance } from '@jsplumb/browser-ui';
export default class TestJsPlump extends LitElement {
    editCount: number;
    instance?: BrowserJsPlumbInstance;
    divRef: HTMLDivElement;
    ied1: HTMLDivElement;
    ied2: HTMLDivElement;
    ied3: HTMLDivElement;
    gelem1: HTMLDivElement;
    subst: HTMLDivElement;
    voltlv: HTMLDivElement;
    bay1: HTMLDivElement;
    bay2: HTMLDivElement;
    bay3: HTMLDivElement;
    protected updated(): void;
    protected firstUpdated(): void;
    render(): import("lit-html").TemplateResult<1>;
    /** render() {
      return html` <div id="container" style="position:relative">
        <div class="group subst" id="subst">
          <div class="group voltlv" id="voltlv">
            <div class="group bay" id="bay1">
              <div
                class="child"
                draggable
                id="ied1"
                style="background-color: green; margin: 10px; width: 100px; height:100px;"
              ></div>
            </div>
            <div class="group bay" id="bay2">
              <div
                class="child"
                draggable
                id="ied2"
                style="background-color: green; margin: 10px;width: 100px; height:100px;"
              ></div>
            </div>
            <div class="group bay" id="bay3">
              <div
                class="child"
                draggable
                id="ied3"
                style="background-color: green; margin: 10px;width: 100px; height:100px;"
              ></div>
            </div>
          </div>
        </div>
      </div>`;
    } */
    static styles: import("lit").CSSResult;
}
