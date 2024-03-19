import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import { sldSvg } from './foundation/sldSvg.js';

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
    return html`<main>${sldSvg(this.substation, this.gridSize)}</main>`;
  }

  static styles = css`
    main {
      width: 100%;
      height: 100%;
    }

    g.voltagelevel {
      opacity: 0.2;
    }

    g.label {
      opacity: 0.2;
    }

    g.node {
      opacity: 0.2;
    }

    svg > g.transformer {
      opacity: 0.2;
    }
  `;
}
