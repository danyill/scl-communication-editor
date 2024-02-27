import { LitElement, TemplateResult } from 'lit';
import { BrowserJsPlumbInstance } from '@jsplumb/browser-ui';
export interface IED {
    name: string;
    x?: number;
    y?: number;
}
export interface Link {
    sink: string;
    source: string;
    type?: string;
}
export default class JsPlumpDiagram extends LitElement {
    doc: XMLDocument;
    editCount: number;
    gridSize: number;
    get ieds(): IED[];
    get links(): Link[];
    instance?: BrowserJsPlumbInstance;
    latestX: number;
    divRef: HTMLDivElement;
    private element;
    protected selectIed(ied: string): void;
    protected updated(): void;
    protected firstUpdated(): void;
    renderIED(ied: IED): TemplateResult;
    render(): TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
