import { css, html, LitElement, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { identity } from '@openenergytools/scl-lib';

import './communication-mapping-editor.js';

import { Connection } from './foundation/types.js';
import { serviceColoring } from './foundation/paths.js';

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

  return Array.from(doc.querySelectorAll(controlBlockSelector)).flatMap(
    sourceCb => {
      const sourceIed = sourceCb.closest('IED')!;

      const sortedClientLns: Record<
        string,
        { ied: Element; inputs: Element[] }
      > = {};
      sourceCb
        .querySelectorAll(':scope > RptEnabled > ClientLN')
        .forEach(clientLn => {
          const targetIed = doc.querySelector(
            `:root > IED[name="${clientLn.getAttribute('iedName')}"`
          );
          const targetIedName = targetIed?.getAttribute('name');
          if (!targetIed || !targetIedName) return;
          if (sortedClientLns[targetIedName])
            sortedClientLns[targetIedName].inputs.push(clientLn);
          else
            sortedClientLns[targetIedName] = {
              ied: targetIed,
              inputs: [clientLn],
            };
        });

      return Object.values(sortedClientLns).map(target => {
        const id = `${identity(sourceCb)}${identity(target.ied)}`;

        return {
          id,
          source: { ied: sourceIed, controlBlock: sourceCb },
          target,
        };
      });
    }
  );
}

function parseExtRefs(doc: XMLDocument): Connection[] {
  const controlBlockSelector = combineSelectors(
    [':root > IED > AccessPoint > Server > LDevice'],
    ['>'],
    ['LN0'],
    ['>'],
    ['GSEControl', 'SampledValueControl']
  );

  return Array.from(doc.querySelectorAll(controlBlockSelector)).flatMap(
    controlBlock => {
      const sourceIed = controlBlock.closest('IED')!;
      const iedName = sourceIed!.getAttribute('name');
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

      const targetMap: Record<string, { ied: Element; inputs: Element[] }> = {};

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
          const targetName = target!.getAttribute('name');
          if (targetName && targetMap[targetName])
            targetMap[targetName].inputs.push(extRef);
          else if (targetName)
            targetMap[targetName] = { ied: target!, inputs: [] };
        });

      return Object.values(targetMap).map(target => {
        const id = `${identity(controlBlock)}${target.ied}`;
        return { id, source: { ied: sourceIed, controlBlock }, target };
      });
    }
  );
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

  // eslint-disable-next-line class-methods-use-this
  renderService(controlBlock: string): TemplateResult[] {
    return [
      html`<svg viewBox="0 0 25 25" width="25" height="25">
        <path
          d="M0,12.5L25,12.5"
          stroke-width="3"
          stroke="${serviceColoring[controlBlock]}"
        />
      </svg>`,
      html`<label>${controlBlock}</label>`,
    ];
  }

  renderInfoBox(): TemplateResult {
    const controlBlocks = [
      'ReportControl',
      'GSEControl',
      'SampledValueControl',
    ];

    return html`<div class="info-box">
      ${controlBlocks.map(controlBlock => this.renderService(controlBlock))}
    </div>`;
  }

  render() {
    if (!this.substation) return html`<main>No substation section</main>`;

    return html`<main>
      ${this.renderInfoBox()}
      <communication-mapping-editor
        .substation=${this.substation}
        .gridSize=${this.gridSize}
        .links=${[
          ...clientLnConnections(this.substation.ownerDocument),
          ...parseExtRefs(this.substation.ownerDocument),
        ]}
      ></communication-mapping-editor>
    </main>`;
  }

  static styles = css`
    main {
      width: 100%;
      height: 100%;
    }

    .info-box {
      display: flex;
      align-items: center;
    }

    .info-box > svg {
      padding: 10px 20px 10px 20px;
    }

    .info-box > label {
      font-family: 'Roboto';
      font-style: normal;
      font-weight: 400;
    }
  `;
}
