/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-return-assign */
import { css, html, LitElement, TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import '@material/mwc-dialog';
import '@material/mwc-button';
import type { Dialog } from '@material/mwc-dialog';

import { newEditEvent } from '@openscd/open-scd-core';

import '@openenergytools/filterable-lists/dist/action-list.js';
import type { ActionItem } from '@openenergytools/filterable-lists/dist/action-list.js';

import { identity, unsubscribe } from '@openenergytools/scl-lib';

import './communication-mapping-editor.js';

import { Connection } from './foundation/types.js';
import {
  inputReference as inputReferenceHeadline,
  inputSupportingText,
} from './foundation/utils.js';

import { sldNs } from './foundation/sldUtil.js';

type SelectConnectionEvent = CustomEvent<Connection>;

function combineSelectors<T>(...selectors: T[][]): string {
  return selectors
    .reduce<T[][]>(
      (a, b) => <T[][]>a.flatMap(d => b.map(e => [d, e].flat())),
      [[]]
    )
    .map(str => str.join(''))
    .join(',');
}

function clientLnConnections(doc: XMLDocument): Connection[] {
  const controlBlockSelector = combineSelectors(
    [':root > IED > AccessPoint > Server > LDevice'],
    ['>'],
    ['LN0', 'LN'],
    ['>'],
    ['ReportControl']
  );

  const iedToNameElement = new Map<string, Element>();
  Array.from(doc.getElementsByTagNameNS(sldNs, 'IEDName')).forEach(iedName =>
    iedToNameElement.set(iedName.getAttributeNS(sldNs, 'name')!, iedName)
  );

  return Array.from(doc.querySelectorAll(controlBlockSelector))
    .flatMap(sourceCb => {
      const sourceIed = sourceCb.closest('IED')!;
      const sourceIedName = iedToNameElement.get(
        sourceIed.getAttribute('name')!
      );

      const sortedClientLns: Record<
        string,
        { ied: Element; iedName: Element; inputs: Element[] }
      > = {};
      sourceCb
        .querySelectorAll(':scope > RptEnabled > ClientLN')
        .forEach(clientLn => {
          const iedName = clientLn.getAttribute('iedName')!;
          const targetIed = doc.querySelector(`:root > IED[name="${iedName}"`);
          const targetIedName = iedToNameElement.get(iedName);

          if (!targetIed || !targetIedName || !iedName) return;
          if (sortedClientLns[iedName])
            sortedClientLns[iedName].inputs.push(clientLn);
          else
            sortedClientLns[iedName] = {
              ied: targetIed,
              iedName: targetIedName,
              inputs: [clientLn],
            };
        });

      return Object.values(sortedClientLns).map(target => {
        const id = `${identity(sourceCb)}${identity(target.ied)}`;

        return {
          id,
          source: {
            ied: sourceIed,
            iedName: sourceIedName,
            controlBlock: sourceCb,
          },
          target,
        };
      });
    })
    .filter(
      (conn): conn is Connection & { source: { iedName: Element } } =>
        conn.source.iedName !== undefined
    );
}

function parseExtRefs(doc: XMLDocument): Connection[] {
  const iedToNameElement = new Map<string, Element>();
  Array.from(doc.getElementsByTagNameNS(sldNs, 'IEDName')).forEach(iedName =>
    iedToNameElement.set(iedName.getAttributeNS(sldNs, 'name')!, iedName)
  );

  const controlBlockSelector = combineSelectors(
    [':root > IED > AccessPoint > Server > LDevice'],
    ['>'],
    ['LN0'],
    ['>'],
    ['GSEControl', 'SampledValueControl']
  );

  return Array.from(doc.querySelectorAll(controlBlockSelector))
    .flatMap(controlBlock => {
      const sourceIed = controlBlock.closest('IED')!;
      const iedName = sourceIed.getAttribute('name')!;
      const sourceIedName = iedToNameElement.get(iedName);
      const ldInst = controlBlock.closest('LDevice')!.getAttribute('inst');
      const anyLn = controlBlock.closest('LN,LN0')!;
      const prefix = anyLn!.getAttribute('prefix');
      const lnClass = anyLn!.getAttribute('lnClass');
      const lnInst = anyLn!.getAttribute('inst');
      const cbName = controlBlock.getAttribute('name');

      const extRefSelector = combineSelectors(
        [':root > IED > AccessPoint > Server > LDevice'],
        ['>'],
        ['LN0', 'LN'],
        ['>'],
        [
          `Inputs > ExtRef[iedName="${iedName}"][srcLNClass="${lnClass}"][srcCBName="${cbName}"]`,
        ]
      );

      const targetMap: Record<
        string,
        { ied: Element; iedName: Element; inputs: Element[] }
      > = {};

      Array.from(doc.querySelectorAll(extRefSelector))
        .filter(extRef => {
          const [extRefLdInst, srcLDInst, srcPrefix, srcLNInst] = [
            'ldInst',
            'srcLDInst',
            'srcPrefix',
            'srcLNInst',
          ].map(attr => extRef.getAttribute(attr));

          return (
            (srcLDInst ? srcLDInst === ldInst : extRefLdInst === srcLDInst) &&
            (srcPrefix ?? '') === (prefix ?? '') &&
            (srcLNInst ?? '') === (lnInst ?? '')
          );
        })
        .forEach(extRef => {
          const target = extRef.closest('IED');
          const targetName = target!.getAttribute('name')!;
          const targetIedName = iedToNameElement.get(targetName);
          if (targetName && targetMap[targetName])
            targetMap[targetName].inputs.push(extRef);
          else if (targetIedName)
            targetMap[targetName] = {
              ied: target!,
              iedName: targetIedName,
              inputs: [extRef],
            };
        });

      return Object.values(targetMap).map(target => {
        const id = `${identity(controlBlock)}${target.ied}`;
        return {
          id,
          source: { ied: sourceIed, iedName: sourceIedName, controlBlock },
          target,
        };
      });
    })
    .filter(
      (
        conn
      ): conn is Connection & { source: { ied: Element } } & {
        target: { ied: Element };
      } => conn.source.iedName !== null && conn.source.iedName !== null
    );
}

function connectionHeading(conn: Connection): string {
  const sourceIedName = conn.source.ied.getAttribute('name');
  const cbName = conn.source.controlBlock.getAttribute('name');
  const targetIedName = conn.target.ied.getAttribute('name');
  return `${sourceIedName}:${cbName} ->${targetIedName}`;
}

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

  @state()
  selectedConnection?: Connection;

  @query('mwc-dialog') removeSelection!: Dialog;

  removeInputs(inputs: Element[]): void {
    const removeClientLNs = inputs
      .filter(input => input.tagName === 'ClientLN')
      .map(clientLn => ({ node: clientLn }));

    const removeExtRefs = unsubscribe(
      inputs.filter(input => input.tagName === 'ExtRef')
    );

    const edits = [...removeClientLNs, ...removeExtRefs];

    if (edits.length > 0) this.dispatchEvent(newEditEvent(edits));
  }

  removeAllInputs(): void {
    const inputs = this.selectedConnection?.target.inputs ?? [];
    this.removeInputs(inputs);

    this.requestUpdate();
  }

  renderRemoveDialog(): TemplateResult {
    const heading = this.selectedConnection
      ? connectionHeading(this.selectedConnection)
      : 'No connection selected';

    const items: ActionItem[] = this.selectedConnection
      ? this.selectedConnection.target.inputs.map(input => ({
          headline: inputReferenceHeadline(input),
          supportingText: inputSupportingText(input),
        }))
      : [];

    const content = html`<action-list
      filterable
      .items=${items}
    ></action-list>`;

    return html`<mwc-dialog heading="${heading}"
      >${content}
      <mwc-button
        slot="secondaryAction"
        label="discard"
        dialogAction="cancel"
        style="--mdc-theme-primary: var(--oscd-error)"
      ></mwc-button>
      <mwc-button
        slot="primaryAction"
        label="remove all"
        icon="link_off"
        @click="${this.removeAllInputs}"
        dialogAction="cancel"
      ></mwc-button
    ></mwc-dialog>`;
  }

  render() {
    if (!this.substation) return html`<main>No substation section</main>`;

    return html`<main>
      <communication-mapping-editor
        .substation=${this.substation}
        .gridSize=${this.gridSize}
        .connections=${[
          ...clientLnConnections(this.substation.ownerDocument),
          ...parseExtRefs(this.substation.ownerDocument),
        ]}
        @select-connection="${(evt: SelectConnectionEvent) => {
          this.selectedConnection = evt.detail;
          this.removeSelection.show();
        }}"
      ></communication-mapping-editor>
      ${this.renderRemoveDialog()}
    </main>`;
  }

  static styles = css`
    main {
      width: 100%;
      height: 100%;
    }

    * {
      --md-sys-color-primary: var(--oscd-primary);
      --md-sys-color-secondary: var(--oscd-secondary);
      --md-sys-typescale-body-large-font: var(--oscd-theme-text-font);
      --md-outlined-text-field-input-text-color: var(--oscd-base01);

      --md-sys-color-surface: var(--oscd-base3);
      --md-sys-color-on-surface: var(--oscd-base00);
      --md-sys-color-on-primary: var(--oscd-base2);
      --md-sys-color-on-surface-variant: var(--oscd-base00);
      --md-menu-container-color: var(--oscd-base3);
      font-family: var(--oscd-theme-text-font);
      --md-sys-color-surface-container-highest: var(--oscd-base2);
    }
  `;
}
