import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

import './test-js-plump.js';

export default class ZeroLine extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = -1;

  render() {
    return html`<button>TestButton</button> <test-js-plump></test-js-plump>`;
  }
}
