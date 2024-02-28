/* eslint-disable no-return-assign */
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

// eslint-disable-next-line import/no-extraneous-dependencies
import { newInstance, BrowserJsPlumbInstance } from '@jsplumb/browser-ui';

@customElement('test-js-plump')
export default class TestJsPlump extends LitElement {
  @property({ attribute: false })
  editCount = -1;

  instance?: BrowserJsPlumbInstance;

  @query(`#container`) divRef!: HTMLDivElement;

  @query(`#ied1`) ied1!: HTMLDivElement;

  @query(`#ied2`) ied2!: HTMLDivElement;

  @query(`#ied3`) ied3!: HTMLDivElement;

  @query(`#ied3`) gelem1!: HTMLDivElement;

  @query(`#subst`) subst!: HTMLDivElement;

  @query(`#voltlv`) voltlv!: HTMLDivElement;

  @query(`#bay1`) bay1!: HTMLDivElement;

  @query(`#bay2`) bay2!: HTMLDivElement;

  @query(`#bay3`) bay3!: HTMLDivElement;

  protected updated(): void {
    this.instance!.connect({ source: this.ied1, target: this.ied2 });
    this.instance!.connect({ source: this.ied2, target: this.ied3 });
    this.instance!.connect({ source: this.ied3, target: this.ied1 });
  }

  protected firstUpdated(): void {
    this.instance = newInstance({
      dragOptions: {
        grid: { w: 50, h: 50 },
      },
      container: this.divRef,
    });

    // this.instance.addGroup({ el: this.subst, id: 'substGroup' });
    // this.instance.addGroup({ el: this.voltlv, id: 'voltlvGroup' });
    this.instance.addGroup({ el: this.bay1, id: 'bay1Group' });
    this.instance.addGroup({ el: this.bay2, id: 'bay2Group' });
    this.instance.addGroup({ el: this.bay3, id: 'bay3Group' });
  }

  render() {
    return html` <div id="container" style="position:relative">
      <div class="group bay" id="bay1">
        <div class="child" id="ied1"></div>
      </div>
      <div class="group bay" id="bay2">
        <div class="child" id="ied2"></div>
      </div>
      <div class="group bay" id="bay3">
        <div class="child" id="ied3"></div>
        <div class="child" id="ied4" style="top: 50px; left:0px"></div>
      </div>
    </div>`;
  }

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

  static styles = css`
    .child {
      position: absolute;
      width: 50px;
      height: 50px;
      background-color: green;
    }

    .group {
      min-height: 200px;
      margin: 10px;
    }

    .subst {
      background-color: blue;
    }

    .voltlv {
      background-color: red;
    }

    .bay {
      background-color: orange;
    }

    .jtk-connected {
      background-color: blue;
    }

    /*
    Assigned to SVG elements for edges. This style allows overlays to paint outside the bounds, and
    for arbitrary stroke widths for connectors. å*/
    .jtk-connector {
      overflow: visible;
    }

    /*
    Assigned to every Node managed by an instance of the Toolkit. They are required to be positioned absolute, to
    enable dragging to work properly. å*/
    .jtk-node {
      position: absolute;
    }

    /*
    Assigned to every Group managed by an instance of the Toolkit. They are required to be positioned absolute, to
    enable dragging to work properly. We set overflow:visible on Group elements too, as a drag outside of the bounds
    is automatically reverted anyway, and without overflow:visible you cannot drag a node to some other element. You can
    also drag a node out of the element's viewport and if you drop it you can never get it back.*/
    .jtk-group {
      position: absolute;
      overflow: visible;
    }
  `;
}
