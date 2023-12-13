export declare function isPublic(element: Element): boolean;
export declare function attachedIEDs(element: Element, remainingIEDs: Set<Element>): Element[];
export declare function getAttachedIEDs(doc: XMLDocument): (element: Element) => Element[];
export declare function gseControlSinkExtRefs(iedName: string, gseControl: Element): Element[];
export declare function smvControlSinkExtRefs(iedName: string, gseControl: Element): Element[];
export declare function rpControlClientLNs(iedName: string, rpControl: Element): Element[];
