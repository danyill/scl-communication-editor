import { fixture, html } from '@open-wc/testing';

// import { sendKeys, sendMouse, setViewport } from '@web/test-runner-commands';

import { visualDiff } from '@web/test-runner-visual-regression';

import SlcCommunicationEditor from './scl-communication-editor.js';

const factor = window.process && process.env.CI ? 4 : 2;
function timeout(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms * factor);
  });
}
mocha.timeout(2000 * factor);

customElements.define('scl-communication-editor', SlcCommunicationEditor);

describe('scl-communication-editor', () => {
  let editor: SlcCommunicationEditor;
  beforeEach(async () => {
    editor = await fixture(
      html`<scl-communication-editor></scl-communication-editor>`
    );
    document.body.prepend(editor);
  });

  afterEach(async () => {
    editor.remove();
  });

  it('looks like the latest snapshot', async () => {
    await editor.updateComplete;
    await timeout(200);
    await visualDiff(editor, `#1 without IED in the SCL`);
  });
});
