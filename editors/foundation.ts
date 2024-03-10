// eslint-disable-next-line import/no-extraneous-dependencies
import { Insert, Remove, Update } from '@openscd/open-scd-core';

import { getReference } from '@openenergytools/scl-lib';

function createElement(
  doc: XMLDocument,
  tag: string,
  attrs: Record<string, string | null>
): Element {
  const element = doc.createElementNS(doc.documentElement.namespaceURI, tag);
  Object.entries(attrs)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_, value]) => value !== null)
    .forEach(([name, value]) => element.setAttribute(name, value!));
  return element;
}

function findFcda(
  dataSet: Element,
  attr: {
    ldInst: string;
    prefix: string;
    lnClass: string;
    lnInst: string;
    doName: string;
    daName?: string;
    fc: string;
  }
): Element | undefined {
  return Array.from(dataSet.children).find(
    fcda =>
      fcda.tagName === 'FCDA' &&
      fcda.getAttribute('ldInst') === attr.ldInst &&
      (fcda.getAttribute('prefix') ?? '') === attr.prefix &&
      (fcda.getAttribute('lnInst') ?? '') === attr.lnInst &&
      fcda.getAttribute('lnClass') === attr.lnClass &&
      fcda.getAttribute('doName') === attr.doName &&
      fcda.getAttribute('daName') === (attr.daName ?? null) &&
      fcda.getAttribute('fc') === attr.fc
  );
}

/** @returns Action array adding new `FCDA`s to parent [[`DataSet`]] */
export function addFCDAs(dataSet: Element, paths: Element[][]): Insert[] {
  const actions: Insert[] = [];
  for (const path of paths) {
    const anyLn = path.find(
      section => section.tagName === 'LN' || section.tagName === 'LN0'
    );
    const lDevice = path.find(section => section.tagName === 'LDevice');

    const ldInst = lDevice?.getAttribute('inst');
    const prefix = anyLn?.getAttribute('prefix') ?? '';
    const lnClass = anyLn?.getAttribute('lnClass');
    const lnInst = anyLn?.getAttribute('inst') ?? '';

    // eslint-disable-next-line no-continue
    if (!ldInst || !lnClass) continue;

    let doName = '';
    let daName = '';
    let fc = '';

    for (const ancestor of path) {
      // eslint-disable-next-line no-continue
      if (!['DO', 'DA', 'SDO', 'BDA'].includes(ancestor.tagName)) continue;

      const name = ancestor.getAttribute('name')!;

      if (ancestor.tagName === 'DO') doName = name;
      if (ancestor.tagName === 'SDO') doName = `${doName}.${name}`;
      if (ancestor.tagName === 'DA') {
        daName = name;
        fc = ancestor.getAttribute('fc') ?? '';
      }
      if (ancestor.tagName === 'BDA') daName = `${daName}.${name}`;
    }
    // eslint-disable-next-line no-continue
    if (!doName || !daName || !fc) continue;

    const fcdaAttrs = {
      ldInst,
      prefix,
      lnClass,
      lnInst,
      doName,
      daName,
      fc,
    };

    // eslint-disable-next-line no-continue
    if (findFcda(dataSet, fcdaAttrs)) continue;

    actions.push({
      parent: dataSet,
      node: createElement(dataSet.ownerDocument, 'FCDA', fcdaAttrs),
      reference: null,
    });
  }

  return actions;
}

/** @returns Action array adding new `FCDA`s to parent [[`DataSet`]] */
export function addFCDOs(
  dataSet: Element,
  fcPaths: { path: Element[]; fc: string }[]
): Insert[] {
  const actions: Insert[] = [];
  for (const fcPath of fcPaths) {
    const anyLn = fcPath.path.find(
      section => section.tagName === 'LN' || section.tagName === 'LN0'
    );
    const lDevice = fcPath.path.find(section => section.tagName === 'LDevice');

    const ldInst = lDevice?.getAttribute('inst');
    const prefix = anyLn?.getAttribute('prefix') ?? '';
    const lnClass = anyLn?.getAttribute('lnClass');
    const lnInst = anyLn?.getAttribute('inst') ?? '';

    // eslint-disable-next-line no-continue
    if (!ldInst || !lnClass) continue;

    let doName = '';
    const { fc } = fcPath;

    for (const ancestor of fcPath.path) {
      // eslint-disable-next-line no-continue
      if (!['DO', 'SDO'].includes(ancestor.tagName)) continue;

      const name = ancestor.getAttribute('name')!;

      if (ancestor.tagName === 'DO') doName = name;
      if (ancestor.tagName === 'SDO') doName = `${doName}.${name}`;
    }
    // eslint-disable-next-line no-continue
    if (!doName) continue;

    const fcdaAttrs = {
      ldInst,
      prefix,
      lnClass,
      lnInst,
      doName,
      fc,
    };

    // eslint-disable-next-line no-continue
    if (findFcda(dataSet, fcdaAttrs)) continue;

    actions.push({
      parent: dataSet,
      node: createElement(dataSet.ownerDocument, 'FCDA', fcdaAttrs),
      reference: null,
    });
  }

  return actions;
}

/** @returns action to update max clients in ReportControl element */
export function updateMaxClients(
  reportControl: Element,
  max: string | null
): Remove | Update | Insert | null {
  const rptEnabled = reportControl.querySelector(':scope > RptEnabled');

  if (rptEnabled && !max) return { node: rptEnabled };
  if (!rptEnabled && !max) return null;
  if (!rptEnabled && max) {
    const newRptEnabled = createElement(
      reportControl.ownerDocument,
      'RptEnabled',
      { max }
    );

    return {
      parent: reportControl,
      node: newRptEnabled,
      reference: getReference(reportControl, 'RptEnabled'),
    };
  }

  return { element: rptEnabled!, attributes: { max } };
}
