export function isPublic(element: Element): boolean {
  return !element.closest('Private');
}

function hasOurs(element: Element, iedName: string): boolean {
  return Array.from(element.getElementsByTagName('LNode'))
    .filter(isPublic)
    .some(lnode => lnode.getAttribute('iedName') === iedName);
}

function getOurs(element: Element, iedName: string): Element[] {
  return Array.from(element.getElementsByTagName('LNode'))
    .filter(isPublic)
    .filter(lnode => lnode.getAttribute('iedName') === iedName);
}

function hasTheirs(element: Element, iedName: string): boolean {
  const ours = getOurs(element, iedName);
  const scl = element.closest('SCL')!;

  return Array.from(scl.getElementsByTagName('LNode'))
    .filter(isPublic)
    .filter(lnode => lnode.getAttribute('iedName') === iedName)
    .some(lnode => !ours.includes(lnode));
}

function containsReference(element: Element, iedName: string): boolean {
  return Array.from(element.getElementsByTagName('LNode'))
    .filter(isPublic)
    .some(lnode => lnode.getAttribute('iedName') === iedName);
}

function hasReferencedChildren(element: Element, iedName: string): boolean {
  const threshold = element.tagName === 'Bay' ? 0 : 1;
  return (
    (<Element[]>Array.from(element.children)).filter(child =>
      containsReference(child, iedName)
    ).length > threshold
  );
}

function isReferencedItself(element: Element, iedName: string): boolean {
  return (<Element[]>Array.from(element.children)).some(
    child =>
      child.tagName === 'LNode' && child.getAttribute('iedName') === iedName
  );
}

export function attachedIEDs(
  element: Element,
  remainingIEDs: Set<Element>
): Element[] {
  const ieds: Element[] = [];

  for (const ied of remainingIEDs) {
    const iedName = ied.getAttribute('name')!;

    if (element.tagName === 'SCL') {
      if (!hasOurs(element, iedName) || hasReferencedChildren(element, iedName))
        ieds.push(ied);
      // eslint-disable-next-line no-continue
    } else if (hasTheirs(element, iedName)) continue;
    else if (
      hasReferencedChildren(element, iedName) ||
      isReferencedItself(element, iedName)
    )
      ieds.push(ied);
  }

  for (const ied of ieds) {
    remainingIEDs.delete(ied);
  }

  return ieds;
}

export function getAttachedIEDs(
  doc: XMLDocument
): (element: Element) => Element[] {
  return (element: Element) => {
    const ieds = new Set(
      Array.from(doc.querySelectorAll(':root > IED')).filter(isPublic)
    );

    return attachedIEDs(element, ieds);
  };
}

export function gseControlSinkExtRefs(
  iedName: string,
  gseControl: Element
): Element[] {
  const srcLDInst = gseControl.closest('LDevice')?.getAttribute('inst');
  const srcCBName = gseControl.getAttribute('name');

  const parentSelector = `:root > IED > AccessPoint > Server > LDevice`;
  const childSelector = `Inputs > ExtRef[iedName="${iedName}"][serviceType="GOOSE"][srcLDInst="${srcLDInst}"][srcCBName="${srcCBName}"]`;
  return Array.from(
    gseControl.ownerDocument.querySelectorAll(
      `${parentSelector} > LN0 > ${childSelector}, ${parentSelector} > LN > ${childSelector}`
    )
  );
}

export function smvControlSinkExtRefs(
  iedName: string,
  gseControl: Element
): Element[] {
  const srcLDInst = gseControl.closest('LDevice')?.getAttribute('inst');
  const srcCBName = gseControl.getAttribute('name');

  const parentSelector = `:root > IED > AccessPoint > Server > LDevice`;
  const childSelector = `Inputs > ExtRef[iedName="${iedName}"][serviceType="SMV"][srcLDInst="${srcLDInst}"][srcCBName="${srcCBName}"]`;
  return Array.from(
    gseControl.ownerDocument.querySelectorAll(
      `${parentSelector} > LN0 > ${childSelector}, ${parentSelector} > LN > ${childSelector}`
    )
  );
}

export function rpControlClientLNs(
  iedName: string,
  rpControl: Element
): Element[] {
  return Array.from(
    rpControl.querySelectorAll(':scope > RptEnabled > ClientLN')
  );
}
