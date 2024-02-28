/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */
import { css, html, LitElement, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { classMap } from 'lit/directives/class-map.js';

import '@material/web/icon/icon';
import '@material/web/iconbutton/outlined-icon-button';

import { newEditEvent } from '@openscd/open-scd-core';
import { identity, unsubscribe } from '@openenergytools/scl-lib';

import {
  getAttachedIEDs,
  gseControlSinkExtRefs,
  rpControlClientLNs,
  smvControlSinkExtRefs,
} from './foundation.js';
import {
  gooseInput,
  goosePublisher,
  reportInput,
  reportPublisher,
  smvInput,
  smvPublisher,
} from './icons.js';

type Node = {
  iedName: string;
  rpout?: Element[];
  rpin?: Element[];
  gseout?: Element[];
  gsein?: Element[];
  smvout?: Element[];
  smvin?: Element[];
};

type IED = {
  gseControls: Element[];
  rpControls: Element[];
  smvControls: Element[];
  clientLns: Element[];
  gseInputs: Element[];
  smvInputs: Element[];
};

type Bay = {
  ieds: Record<string, IED>;
};

type VoltageLevel = {
  bays: Record<string, Bay>;
  ieds: Record<string, IED>;
};

type Substation = {
  voltageLevels: Record<string, VoltageLevel>;
  ieds: Record<string, IED>;
};

function gseControls(
  ied: Element,
  type: 'GSEControl' | 'SampledValueControl' | 'ReportControl'
): Element[] {
  const parentSelector = ':scope > AccessPoint > Server > LDevice';

  if (type === 'ReportControl')
    return Array.from(
      ied.querySelectorAll(
        `${parentSelector} > LN0 > ${type}, ${parentSelector} > LN > ${type}`
      )
    );

  return Array.from(ied.querySelectorAll(`${parentSelector} > LN0 > ${type}`));
}

function clientLNs(ied: Element): Element[] {
  const iedName = ied.getAttribute('name');

  const parentSelector = ':root > IED > AccessPoint > Server > LDevice';
  const childSelector = `ReportControl > RptEnabled > ClientLN[iedName="${iedName}"]`;

  return Array.from(
    ied.ownerDocument.querySelectorAll(
      `${parentSelector} > LN0 > ${childSelector}, ${parentSelector} > LN > ${childSelector}`
    )
  );
}

function gseInputs(ied: Element): Element[] {
  const parentSelector = ':root > IED > AccessPoint > Server > LDevice';
  const childSelector = `Inputs > ExtRef[iedName][serviceType="GOOSE"]`;

  return Array.from(
    ied.querySelectorAll(
      `${parentSelector} > LN0 > ${childSelector}, ${parentSelector} > LN > ${childSelector}`
    )
  );
}

function smvInputs(ied: Element): Element[] {
  const parentSelector = ':scope > AccessPoint > Server > LDevice';
  const childSelector = `Inputs > ExtRef[iedName][serviceType="SMV"]`;

  return Array.from(
    ied.querySelectorAll(
      `${parentSelector} > LN0 > ${childSelector}, ${parentSelector} > LN > ${childSelector}`
    )
  );
}

function getIEDs(
  parent: Element,
  attachedIEDs: (element: Element) => Element[]
): Record<string, IED> {
  const iedRecord: Record<string, IED> = {};

  const ieds = attachedIEDs(parent);
  for (const ied of ieds) {
    const iedName = ied.getAttribute('name');

    if (iedName)
      iedRecord[iedName] = {
        rpControls: gseControls(ied, 'ReportControl'),
        gseControls: gseControls(ied, 'GSEControl'),
        smvControls: gseControls(ied, 'SampledValueControl'),
        clientLns: clientLNs(ied),
        gseInputs: gseInputs(ied),
        smvInputs: smvInputs(ied),
      };
  }

  return iedRecord;
}

function getBays(
  voltageLevel: Element,
  attachedIEDs: (element: Element) => Element[]
): Record<string, Bay> {
  const bayRecord: Record<string, Bay> = {};

  const bays = Array.from(voltageLevel.querySelectorAll(':scope > Bay'));

  for (const bay of bays) {
    const bayName = bay.getAttribute('name');
    const bayStruct: Bay = {
      ieds: getIEDs(bay, attachedIEDs),
    };

    if (bayName) bayRecord[bayName] = bayStruct;
  }

  return bayRecord;
}

function getVoltageLevels(
  substation: Element,
  attachedIEDs: (element: Element) => Element[]
): Record<string, VoltageLevel> {
  const voltLvRecord: Record<string, VoltageLevel> = {};

  for (const voltageLevel of Array.from(
    substation.querySelectorAll(':scope > VoltageLevel')
  )) {
    const voltLvName = voltageLevel.getAttribute('name');

    const ieds = getIEDs(voltageLevel, attachedIEDs);

    const voltLvStruct: VoltageLevel = {
      bays: getBays(voltageLevel, attachedIEDs),
      ieds,
    };

    if (voltLvName) voltLvRecord[voltLvName] = voltLvStruct;
  }

  return voltLvRecord;
}

export function parseDoc(doc: XMLDocument): Record<string, Substation> {
  const struct: Record<string, Substation> = {};

  const attachedIEDs = getAttachedIEDs(doc);

  for (const substation of Array.from(
    doc.querySelectorAll(':root > Substation')
  )) {
    const substationName = substation.getAttribute('name');
    const ieds = getIEDs(doc.documentElement, attachedIEDs);

    const substationStruct: Substation = {
      voltageLevels: getVoltageLevels(substation, attachedIEDs),
      ieds,
    };

    if (substationName) struct[substationName] = substationStruct;
  }

  return struct;
}

export default class CommunicationMappingPlugin extends LitElement {
  _struct: Record<string, Substation> = {};

  _doc?: XMLDocument;

  @property({ attribute: false })
  set doc(doc: XMLDocument | undefined) {
    if (!doc) return;

    this._struct = parseDoc(doc);
    this._doc = doc;
    this.requestUpdate();
  }

  /** SCL change indicator */
  @property({ type: Number })
  editCount = -1;

  @state()
  selection: string | null = null;

  @state()
  selectionGroup: Set<string> = new Set();

  @state()
  start: Node | null = null;

  @state()
  ends: Node[] = [];

  @state()
  hideSidebar: boolean = false;

  onSelectClientLNs(iedName: string, clients: Element[]): void {
    this.start = {
      iedName,
      rpin: clients,
    };

    this.ends = clients
      .filter(
        clientLN =>
          clientLN.closest('IED') &&
          clientLN.closest('IED')?.getAttribute('name')
      )
      .map(clientLN => ({
        iedName: clientLN.closest('IED')!.getAttribute('name')!,
        rpout: [clientLN.closest('ReportControl')!],
      }));
  }

  onSelectReports(iedName: string, reports: Element[]): void {
    this.start = {
      iedName,
      rpout: reports,
    };

    this.ends = reports.flatMap(report =>
      Array.from(report.querySelectorAll(':scope > RptEnabled > ClientLN'))
        .filter(clientLn => clientLn.getAttribute('iedName'))
        .map(clientLn => ({
          iedName: clientLn.getAttribute('iedName')!,
          rpin: [clientLn],
        }))
    );
  }

  onSelectGoose(iedName: string, _gseControls: Element[]): void {
    this.start = {
      iedName,
      gseout: _gseControls,
    };

    this.ends = _gseControls.flatMap(gseControl => {
      const extRefs = gseControlSinkExtRefs(iedName, gseControl);

      return extRefs.map(extRef => ({
        iedName: extRef.closest('IED')?.getAttribute('name')!,
        gsein: [extRef],
      }));
    });
  }

  onSelectGooseInputs(iedName: string, inputs: Element[]): void {
    this.start = {
      iedName,
      gsein: inputs,
    };

    this.ends = inputs.flatMap(extRef => {
      const srcIedName = extRef.getAttribute('iedName');
      const srcLDInst = extRef.getAttribute('srcLDInst');
      const srcCBName = extRef.getAttribute('srcCBName');

      const selector = `:root > IED[name="${srcIedName}"] > AccessPoint > Server > LDevice[inst="${srcLDInst}"] > LN0 > GSEControl[name="${srcCBName}"]`;
      return Array.from(extRef.ownerDocument.querySelectorAll(selector)).map(
        gseControl => ({
          iedName: srcIedName!,
          gseout: [gseControl],
        })
      );
    });
  }

  onSelectSmvControl(iedName: string, smvControls: Element[]): void {
    this.start = {
      iedName,
      smvout: smvControls,
    };

    this.ends = smvControls.flatMap(gseControl => {
      const srcLDInst = gseControl.closest('LDevice')?.getAttribute('inst');
      const srcCBName = gseControl.getAttribute('name');

      const parentSelector = `:root > IED > AccessPoint > Server > LDevice`;
      const childSelector = `Inputs > ExtRef[iedName="${iedName}"][serviceType="SMV"][srcLDInst="${srcLDInst}"][srcCBName="${srcCBName}"]`;
      return Array.from(
        gseControl.ownerDocument.querySelectorAll(
          `${parentSelector} > LN0 > ${childSelector}, ${parentSelector} > LN > ${childSelector}`
        )
      ).map(extRef => ({
        iedName: extRef.closest('IED')?.getAttribute('name')!,
        smvin: [extRef],
      }));
    });
  }

  onSelectSmvInputs(iedName: string, inputs: Element[]): void {
    this.start = {
      iedName,
      smvin: inputs,
    };

    this.ends = inputs.flatMap(extRef => {
      const srcIedName = extRef.getAttribute('iedName');
      const srcLDInst = extRef.getAttribute('srcLDInst');
      const srcCBName = extRef.getAttribute('srcCBName');

      const selector = `:root > IED[name="${srcIedName}"] > AccessPoint > Server > LDevice[inst="${srcLDInst}"] > LN0 > SampledValueControl[name="${srcCBName}"]`;
      return Array.from(extRef.ownerDocument.querySelectorAll(selector)).map(
        smvControl => ({
          iedName: srcIedName!,
          smvout: [smvControl],
        })
      );
    });
  }

  onSelectIED(iedName: string): void {
    const extRefConnections = Array.from(
      this._doc?.querySelectorAll(`ExtRef[iedName="${iedName}"]`) ?? []
    )
      .filter(conn => {
        if (conn.tagName === 'ExtRef') return true;

        return false;
      })
      .map(conn => conn.closest('IED')?.getAttribute('name') ?? 'NONE');

    const otherConnections = Array.from(
      this._doc?.querySelectorAll(
        `IED[name="${iedName}"] ClientLN,IED[name="${iedName}"] IEDName`
      ) ?? []
    ).map(conn => {
      if (conn.tagName === 'ClientLN')
        return conn.getAttribute('iedName') ?? 'NONE';

      return conn.textContent ?? 'NONE';
    });

    this.selectionGroup = new Set(extRefConnections.concat(otherConnections));
    this.selection = iedName;

    this.requestUpdate('selectionGroup');
  }

  renderIED(iedName: string, ied: IED): TemplateResult {
    const end = this.ends.find(conn => conn.iedName === iedName);
    const isStart = iedName === this.start?.iedName;

    let node = null;
    if (!this.start)
      node = {
        rpout: true,
        rpin: true,
        gseout: true,
        gsein: true,
        smvout: true,
        smvin: true,
      };
    else if (isStart) node = this.start;
    else node = end;

    // eslint-disable-next-line lit-a11y/click-events-have-key-events
    return html`<div
      class="${classMap({
        element: true,
        ied: true,
        highlighted: !!end,
        selected: isStart,
      })}"
      @click="${() => this.onSelectIED(iedName)}"
    >
      <md-icon class="icon ied">developer_board</md-icon>
      <footer>${iedName}</footer>
      <div class="container publisher">
        <md-icon
          class="${classMap({
            services: true,
            rpout: true,
            hidden: !ied.rpControls.length,
            background: !node?.rpout,
            start: !!node && !!node.rpout && isStart,
            end: !!node && !!node.rpout && !isStart,
          })}"
          @click="${(evt: Event) => {
            evt.stopPropagation();
            this.onSelectReports(iedName, ied.rpControls);
          }}"
          >${reportPublisher}</md-icon
        >
        <md-icon
          class="${classMap({
            services: true,
            gseout: true,
            hidden: !ied.gseControls.length,
            background: !node?.gseout,
            start: !!node && !!node.gseout && isStart,
            end: !!node && !!node.gseout && !isStart,
          })}"
          @click="${(evt: Event) => {
            evt.stopPropagation();
            this.onSelectGoose(iedName, ied.gseControls);
          }}"
          >${goosePublisher}</md-icon
        >
        <md-icon
          class="${classMap({
            services: true,
            smvout: true,
            hidden: !ied.smvControls.length,
            background: !node?.smvout,
            start: !!node && !!node.smvout && isStart,
            end: !!node && !!node.smvout && !isStart,
          })}"
          @click="${(evt: Event) => {
            evt.stopPropagation();
            this.onSelectSmvControl(iedName, ied.smvControls);
          }}"
          >${smvPublisher}</md-icon
        >
      </div>
      <div class="container inputs">
        <md-icon
          class="${classMap({
            services: true,
            rpin: true,
            hidden: !ied.clientLns.length,
            background: !node?.rpin,
            start: !!node && !!node.rpin && isStart,
            end: !!node && !!node.rpin && !isStart,
          })}"
          @click="${(evt: Event) => {
            evt.stopPropagation();
            this.onSelectClientLNs(iedName, ied.clientLns);
          }}"
          >${reportInput}</md-icon
        >
        <md-icon
          class="${classMap({
            services: true,
            gsein: true,
            hidden: !ied.gseInputs.length,
            background: !node?.gsein,
            start: !!node && !!node.gsein && isStart,
            end: !!node && !!node.gsein && !isStart,
          })}"
          @click="${(evt: Event) => {
            evt.stopPropagation();
            this.onSelectGooseInputs(iedName, ied.gseInputs);
          }}"
          >${gooseInput}</md-icon
        >
        <md-icon
          class="${classMap({
            services: true,
            smvin: true,
            hidden: !ied.smvInputs.length,
            background: !node?.smvin,
            start: !!node && !!node.smvin && isStart,
            end: !!node && !!node.smvin && !isStart,
          })}"
          @click="${(evt: Event) => {
            evt.stopPropagation();
            this.onSelectSmvInputs(iedName, ied.smvInputs);
          }}"
          >${smvInput}</md-icon
        >
      </div>
    </div>`;
  }

  renderVIEDs(ieds: Record<string, IED>): TemplateResult {
    return html`<div class="container ied vertical">
      ${Object.entries(ieds).map(([key, value]) => this.renderIED(key, value))}
    </div>`;
  }

  renderIEDs(ieds: Record<string, IED>): TemplateResult {
    return html`<div class="container ied horizontal">
      ${Object.entries(ieds).map(([key, value]) => this.renderIED(key, value))}
    </div>`;
  }

  renderBays(bays: Record<string, Bay>): TemplateResult[] {
    return Object.entries(bays).map(
      ([key, value]) =>
        html`<div class="element bay">
          <h3>${key}</h3>
          ${this.renderIEDs(value.ieds)}
        </div>`
    );
  }

  renderVoltageLevels(
    voltageLevels: Record<string, VoltageLevel>
  ): TemplateResult[] {
    return Object.entries(voltageLevels).map(
      ([key, value]) =>
        html`<div class="container voltLv">
          <h2>${key}</h2>
          ${this.renderVIEDs(value.ieds)}
          <div class="container bay">${this.renderBays(value.bays)}</div>
        </div>`
    );
  }

  renderSubstations(): TemplateResult[] {
    return Object.entries(this._struct).map(
      ([key, value]) =>
        html`<div class="container substation">
          <h1>${key}</h1>
          ${this.renderVIEDs(value.ieds)}
          ${this.renderVoltageLevels(value.voltageLevels)}
        </div>`
    );
  }

  renderClientSidebar(clientLns: Element[]): TemplateResult {
    const sortedInput: Record<string, Element[]> = {};
    clientLns.forEach(clientLn => {
      const iedName = clientLn.closest('IED')?.getAttribute('name');
      const srcLDInst = clientLn.closest('LDevice')?.getAttribute('inst');
      const srcCBName = clientLn.closest('ReportControl')?.getAttribute('name');

      const ctrlObjRef = `${iedName}${srcLDInst}/LLN0.${srcCBName}`;
      if (sortedInput[ctrlObjRef]) sortedInput[ctrlObjRef].push(clientLn);
      else sortedInput[ctrlObjRef] = [clientLn];
    });

    return html`${Object.entries(sortedInput).map(
      ([key, value]) =>
        html`<div style="margin: 4px;">
          <style>
            .show.more[selected] ~ div > div {
              display: block;
            }

            .show.more:not([selected]) ~ div > div {
              display: none;
            }
          </style>
          <md-outlined-icon-button
            class="show more"
            toggle
            style="width:32px;height:32px;float:right;"
            ><md-icon slot="selected">keyboard_arrow_down</md-icon>
            <md-icon> keyboard_arrow_up </md-icon></md-outlined-icon-button
          >
          <md-outlined-icon-button
            style="width:32px;height:32px;float:right;"
            @click="${() =>
              this.dispatchEvent(newEditEvent(unsubscribe(value)))}"
            ><md-icon>delete</md-icon></md-outlined-icon-button
          >
          <div>
            <h3>${key}</h3>
            <div>
              ${value.map(
                val =>
                  html`<div style="margin: 4px; display: flex;">
                    <div style="flex:auto">${identity(val)}</div>
                    <md-outlined-icon-button
                      style="width:32px;height:32px;"
                      @click="${() =>
                        this.dispatchEvent(newEditEvent(unsubscribe([val])))}"
                      ><md-icon>delete</md-icon></md-outlined-icon-button
                    >
                  </div>`
              )}
            </div>
          </div>
        </div>`
    )}`;
  }

  renderRpOutSidebar(start: Node): TemplateResult {
    return html`${start
      .rpout!.filter(rp => rp.getAttribute('datSet'))
      .map(rpControl => {
        const sortedClientLNs: Record<string, Element[]> = {};
        rpControlClientLNs(start.iedName, rpControl).forEach(clientLn => {
          const srcIed = clientLn.getAttribute('iedName');
          if (srcIed && sortedClientLNs[srcIed])
            sortedClientLNs[srcIed].push(clientLn);
          else if (srcIed) sortedClientLNs[srcIed] = [clientLn];
        });

        return html`<div style="margin: 4px;">
          <h2>${rpControl.getAttribute('name')}</h2>
          ${Object.entries(sortedClientLNs).map(
            ([key, value]) =>
              html`<div style="margin: 4px;">
                <style>
                  .show.more[selected] ~ div > div {
                    display: block;
                  }

                  .show.more:not([selected]) ~ div > div {
                    display: none;
                  }
                </style>
                <md-outlined-icon-button
                  class="show more"
                  toggle
                  style="width:32px;height:32px;float:right;"
                  ><md-icon slot="selected">keyboard_arrow_down</md-icon>
                  <md-icon>keyboard_arrow_up</md-icon></md-outlined-icon-button
                >
                <md-outlined-icon-button
                  style="width:32px;height:32px;float:right;"
                  ><md-icon>delete</md-icon></md-outlined-icon-button
                >
                <div>
                  <h3>${key}</h3>
                  <div>
                    ${value.map(
                      val =>
                        html`<div style="margin: 4px; display: flex;">
                          <div style="flex:auto">${identity(val)}</div>
                          <md-outlined-icon-button
                            style="width:32px;height:32px;"
                            ><md-icon>delete</md-icon></md-outlined-icon-button
                          >
                        </div>`
                    )}
                  </div>
                </div>
              </div>`
          )}
        </div>`;
      })}`;
  }

  renderSmvOutSidebar(start: Node): TemplateResult {
    return html`${start.smvout!.map(smvControl => {
      const sortedExtRefs: Record<string, Element[]> = {};
      smvControlSinkExtRefs(start.iedName, smvControl).forEach(extRef => {
        const srcIed = extRef.closest('IED')?.getAttribute('name');
        if (srcIed && sortedExtRefs[srcIed]) sortedExtRefs[srcIed].push(extRef);
        else if (srcIed) sortedExtRefs[srcIed] = [extRef];
      });

      return html`<div style="margin: 4px;">
        <h2>${smvControl.getAttribute('name')}</h2>
        ${Object.entries(sortedExtRefs).map(
          ([key, value]) =>
            html`<div style="margin: 4px;">
              <style>
                .show.more[selected] ~ div > div {
                  display: block;
                }

                .show.more:not([selected]) ~ div > div {
                  display: none;
                }
              </style>
              <md-outlined-icon-button
                class="show more"
                toggle
                style="width:32px;height:32px;float:right;"
                ><md-icon slot="selected">keyboard_arrow_down</md-icon>
                <md-icon> keyboard_arrow_up </md-icon></md-outlined-icon-button
              >
              <md-outlined-icon-button
                style="width:32px;height:32px;float:right;"
                @click="${() =>
                  this.dispatchEvent(newEditEvent(unsubscribe(value)))}"
                ><md-icon>delete</md-icon></md-outlined-icon-button
              >
              <div>
                <h3>${key}</h3>
                <div>
                  ${value.map(
                    val =>
                      html`<div style="margin: 4px; display: flex;">
                        <div style="flex:auto">${identity(val)}</div>
                        <md-outlined-icon-button
                          style="width:32px;height:32px;"
                          @click="${() =>
                            this.dispatchEvent(
                              newEditEvent(unsubscribe([val]))
                            )}"
                          ><md-icon>delete</md-icon></md-outlined-icon-button
                        >
                      </div>`
                  )}
                </div>
              </div>
            </div>`
        )}
      </div>`;
    })}`;
  }

  renderInputSidebar(inputs: Element[]): TemplateResult {
    const sortedInput: Record<string, Element[]> = {};
    inputs.forEach(extRef => {
      const iedName = extRef.getAttribute('iedName');
      const srcLDInst = extRef.getAttribute('srcLDInst');
      const srcCBName = extRef.getAttribute('srcCBName');

      const ctrlObjRef = `${iedName}${srcLDInst}/LLN0.${srcCBName}`;
      if (sortedInput[ctrlObjRef]) sortedInput[ctrlObjRef].push(extRef);
      else sortedInput[ctrlObjRef] = [extRef];
    });

    return html`${Object.entries(sortedInput).map(
      ([key, value]) =>
        html`<div style="margin: 4px;">
          <style>
            .show.more[selected] ~ div > div {
              display: block;
            }

            .show.more:not([selected]) ~ div > div {
              display: none;
            }
          </style>
          <md-outlined-icon-button
            class="show more"
            toggle
            style="width:32px;height:32px;float:right;"
            ><md-icon slot="selected">keyboard_arrow_down</md-icon>
            <md-icon> keyboard_arrow_up </md-icon></md-outlined-icon-button
          >
          <md-outlined-icon-button
            style="width:32px;height:32px;float:right;"
            @click="${() =>
              this.dispatchEvent(newEditEvent(unsubscribe(value)))}"
            ><md-icon>delete</md-icon></md-outlined-icon-button
          >
          <div>
            <h3>${key}</h3>
            <div>
              ${value.map(
                val =>
                  html`<div style="margin: 4px; display: flex;">
                    <div style="flex:auto">${identity(val)}</div>
                    <md-outlined-icon-button
                      style="width:32px;height:32px;"
                      @click="${() =>
                        this.dispatchEvent(newEditEvent(unsubscribe([val])))}"
                      ><md-icon>delete</md-icon></md-outlined-icon-button
                    >
                  </div>`
              )}
            </div>
          </div>
        </div>`
    )}`;
  }

  renderGooseOutSidebar(start: Node): TemplateResult {
    return html`${start.gseout!.map(gseControl => {
      const sortedExtRefs: Record<string, Element[]> = {};
      gseControlSinkExtRefs(start.iedName, gseControl).forEach(extRef => {
        const srcIed = extRef.closest('IED')?.getAttribute('name');
        if (srcIed && sortedExtRefs[srcIed]) sortedExtRefs[srcIed].push(extRef);
        else if (srcIed) sortedExtRefs[srcIed] = [extRef];
      });

      return html`<div style="margin: 4px;">
        <h2>${gseControl.getAttribute('name')}</h2>
        ${Object.entries(sortedExtRefs).map(
          ([key, value]) =>
            html`<div style="margin: 4px;">
              <style>
                .show.more[selected] ~ div > div {
                  display: block;
                }

                .show.more:not([selected]) ~ div > div {
                  display: none;
                }
              </style>
              <md-outlined-icon-button
                class="show more"
                toggle
                style="width:32px;height:32px;float:right;"
                ><md-icon slot="selected">keyboard_arrow_down</md-icon>
                <md-icon> keyboard_arrow_up </md-icon></md-outlined-icon-button
              >
              <md-outlined-icon-button
                style="width:32px;height:32px;float:right;"
                @click="${() =>
                  this.dispatchEvent(newEditEvent(unsubscribe(value)))}"
                ><md-icon>delete</md-icon></md-outlined-icon-button
              >
              <div>
                <h3>${key}</h3>
                <div>
                  ${value.map(
                    val =>
                      html`<div style="margin: 4px; display: flex;">
                        <div style="flex:auto">${identity(val)}</div>
                        <md-outlined-icon-button
                          style="width:32px;height:32px;"
                          @click="${() =>
                            this.dispatchEvent(
                              newEditEvent(unsubscribe([val]))
                            )}"
                          ><md-icon>delete</md-icon></md-outlined-icon-button
                        >
                      </div>`
                  )}
                </div>
              </div>
            </div>`
        )}
      </div>`;
    })}`;
  }

  renderSideBar(): TemplateResult {
    let indernal: TemplateResult = html``;
    if (this.start?.gseout) indernal = this.renderGooseOutSidebar(this.start);
    else if (this.start?.gsein)
      indernal = this.renderInputSidebar(this.start.gsein);
    else if (this.start?.smvout)
      indernal = this.renderSmvOutSidebar(this.start);
    else if (this.start?.smvin)
      indernal = this.renderInputSidebar(this.start.smvin);
    else if (this.start?.rpout) indernal = this.renderRpOutSidebar(this.start);
    else if (this.start?.rpin)
      indernal = this.renderClientSidebar(this.start.rpin);

    return html`<div
      class=${classMap({
        sidebar: true,
        hidden: !this.start,
      })}
    >
      <div>${indernal}</div>
    </div>`;
  }

  render() {
    return html`<section>
      ${this.renderSubstations()} ${this.renderSideBar()}
    </section>`;
  }

  static styles = css`
    section {
      display: flex;
    }

    .sidebar {
      position: fixed;
      right: 0px;
      width: 500px;
      height: 100%;
      background-color: var(--oscd-theme-base3, #eee8d5);
      border: 3px solid;
      border-color: black;
      margin: 4px;
      overflow-y: auto;
    }

    .sidebar.hidden {
      display: none;
    }

    .container.substation {
      background-color: var(--oscd-theme-base3, #eee8d5);
      padding-left: 30px;
      padding-right: 30px;
      margin: 4px 8px 16px;
      flex: auto;
    }

    .container.voltLv {
      background-color: var(--oscd-theme-base2, #fdf6e3);
      padding-left: 30px;
      padding-right: 30px;
      padding-bottom: 20px;
      margin-bottom: 20px;
      margin-top: 4px;
    }

    .container.bay {
      display: flex;
      grid-gap: 30px;
    }

    .element.bay {
      background-color: var(--oscd-theme-base3, #eee8d5);
      width: 60px;
      padding-left: 30px;
      padding-right: 30px;
      padding-bottom: 20px;
    }

    .container.ied.horizontal {
      display: grid;
      grid-gap: 30px;
    }

    .container.ied.vertical {
      display: flex;
      grid-gap: 30px;
      padding-bottom: 30px;
    }

    .element.ied {
      width: 60px;
      height: 60px;
    }

    .icon.ied {
      --md-icon-size: 60px;
      font-size: 60px;
      width: 60px;
      height: 60px;
    }

    .services {
      position: relative;
      width: 20px;
      height: 20px;
      margin: -1.5px;
    }

    .services.background {
      opacity: 0.3;
    }

    .services.start {
      background-color: var(--oscd-theme-primary, #2aa198);
      border-radius: 8px;
    }

    .services.end {
      background-color: var(--oscd-theme-primary, #6c71c4);
      border-radius: 8px;
    }

    .services.hidden {
      opacity: 0;
      pointer-events: none;
    }

    .container.publisher {
      position: relative;
      top: -90px;
      width: 60px;
    }

    .container.inputs {
      position: relative;
      top: -51px;
      width: 60px;
    }

    h1,
    h2,
    h3 {
      padding: 4px 8px 16px;
      margin: 0px;
    }

    footer {
      position: relative;
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      font-weight: 300;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin: 0px;
      text-align: center;
      align-self: center;
      width: 60px;
      direction: rtl;
      transform: rotate(-90deg);
      top: -40px;
      left: 40px;
    }

    .side.board {
      position: absolute;
      width: 50%;
      height: 100%;
      background-color: grey;
      right: 0px;
    }
  `;
}
