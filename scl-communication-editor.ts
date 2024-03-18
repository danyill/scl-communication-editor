import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

export default class SlcCommunicationEditor extends LitElement {
  @property({ attribute: false })
  doc?: XMLDocument;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = -1;

  render() {
    return html`<main>No SCL loaded</main>`;
  }

  static styles = css`
    main {
      width: 100%;
      height: 100%;
    }
  `;
}
