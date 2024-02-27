import { LitElement, TemplateResult } from 'lit';
import '@material/web/icon/icon';
import '@material/web/iconbutton/outlined-icon-button';
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
export declare function parseDoc(doc: XMLDocument): Record<string, Substation>;
export default class CommunicationMappingPlugin extends LitElement {
    _struct: Record<string, Substation>;
    _doc?: XMLDocument;
    set doc(doc: XMLDocument | undefined);
    /** SCL change indicator */
    editCount: number;
    selection: string | null;
    selectionGroup: Set<string>;
    start: Node | null;
    ends: Node[];
    hideSidebar: boolean;
    onSelectClientLNs(iedName: string, clients: Element[]): void;
    onSelectReports(iedName: string, reports: Element[]): void;
    onSelectGoose(iedName: string, _gseControls: Element[]): void;
    onSelectGooseInputs(iedName: string, inputs: Element[]): void;
    onSelectSmvControl(iedName: string, smvControls: Element[]): void;
    onSelectSmvInputs(iedName: string, inputs: Element[]): void;
    onSelectIED(iedName: string): void;
    renderIED(iedName: string, ied: IED): TemplateResult;
    renderVIEDs(ieds: Record<string, IED>): TemplateResult;
    renderIEDs(ieds: Record<string, IED>): TemplateResult;
    renderBays(bays: Record<string, Bay>): TemplateResult[];
    renderVoltageLevels(voltageLevels: Record<string, VoltageLevel>): TemplateResult[];
    renderSubstations(): TemplateResult[];
    renderClientSidebar(clientLns: Element[]): TemplateResult;
    renderRpOutSidebar(start: Node): TemplateResult;
    renderSmvOutSidebar(start: Node): TemplateResult;
    renderInputSidebar(inputs: Element[]): TemplateResult;
    renderGooseOutSidebar(start: Node): TemplateResult;
    renderSideBar(): TemplateResult;
    render(): TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
export {};
