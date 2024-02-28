import { TemplateResult, html } from 'lit';

import '@material/web/icon/icon';
import '@material/web/iconbutton/outlined-icon-button';

import { identity, unsubscribe } from '@openenergytools/scl-lib';

import { gseControlSinkExtRefs } from './foundation.js';

export function renderGooseOutSidebar(
  doc: XMLDocument,
  iedName: string
): TemplateResult {
  const gseControlsElements = Array.from(
    doc?.querySelectorAll(
      `:root > IED[name="${iedName}"] > AccessPoint > Server > LDevice > LN0 > GSEControl`
    ) ?? []
  );

  return html`${gseControlsElements.map(gseControl => {
    const sortedExtRefs: Record<string, Element[]> = {};
    gseControlSinkExtRefs(iedName, gseControl).forEach(extRef => {
      const srcIed = extRef.closest('IED')?.getAttribute('name');
      if (srcIed && sortedExtRefs[srcIed]) sortedExtRefs[srcIed].push(extRef);
      else if (srcIed) sortedExtRefs[srcIed] = [extRef];
    });

    return html`<div style="margin: 4px;">
      ${gseControl.getAttribute('name')}
      ${Object.entries(sortedExtRefs).map(
        ([key, value]) =>
          html`<div style="margin: 4px;">
            ${key}<md-outlined-icon-button @click="${() => unsubscribe(value)}"
              ><md-icon>delete</md-icon></md-outlined-icon-button
            >
            ${value.map(
              val =>
                html`<div style="margin: 4px;">
                  ${identity(val)}
                  <md-outlined-icon-button @click="${() => unsubscribe([val])}"
                    ><md-icon>delete</md-icon></md-outlined-icon-button
                  >
                </div>`
            )}
          </div>`
      )}
    </div>`;
  })}`;
}
