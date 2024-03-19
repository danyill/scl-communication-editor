import { fixture, html } from '@open-wc/testing';

import { setViewport } from '@web/test-runner-commands';

import { visualDiff } from '@web/test-runner-visual-regression';

import { ssd } from './testfiles.js';

import SlcCommunicationEditor from './scl-communication-editor.js';

const factor = window.process && process.env.CI ? 4 : 2;
function timeout(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms * factor);
  });
}
mocha.timeout(2000 * factor);

customElements.define('scl-communication-editor', SlcCommunicationEditor);

const pureSSD = new DOMParser().parseFromString(ssd, 'application/xml');

describe('scl-communication-editor', () => {
  describe('without SCL loaded', () => {
    let editor: SlcCommunicationEditor;
    beforeEach(async () => {
      editor = await fixture(
        html`<scl-communication-editor></scl-communication-editor>`
      );

      document.body.style.width = '100%';
      document.body.style.height = '100%';

      document.body.prepend(editor);
    });

    afterEach(async () => {
      editor.remove();
    });

    it('looks like the latest snapshot', async () => {
      await editor.updateComplete;
      await timeout(200);
      await visualDiff(editor, `#1 without Substation loaded`);
    });
  });

  describe('without pure SSD loaded', () => {
    setViewport({ width: 1400, height: 1000 });

    let editor: SlcCommunicationEditor;
    beforeEach(async () => {
      editor = await fixture(
        html`<scl-communication-editor
          .doc=${pureSSD}
        ></scl-communication-editor>`
      );
      document.body.prepend(editor);
    });

    afterEach(async () => {
      editor.remove();
    });

    it('looks like the latest snapshot', async () => {
      await editor.updateComplete;
      await timeout(200);
      await visualDiff(editor, `#2 without any IEDs loaded`);
    });
  });
});
