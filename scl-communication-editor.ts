import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import './communication-mapping-editor.js';

export default class SlcCommunicationEditor extends LitElement {
  @property({ attribute: false })
  doc?: XMLDocument;

  @property({ attribute: false })
  get substation(): Element | null {
    return this.doc?.querySelector(':root > Substation') ?? null;
  }

  @state()
  gridSize = 32;

  @property({ type: Number })
  editCount = -1;

  render() {
    if (!this.substation) return html`<main>No substation section</main>`;

    return html`<main>
      <communication-mapping-editor
        .substation=${this.substation}
        .gridSize=${this.gridSize}
      ></communication-mapping-editor>
    </main>`;
  }

  static styles = css`
    main {
      width: 100%;
      height: 100%;
    }
  `;
}
