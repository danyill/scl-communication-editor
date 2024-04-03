import { LitElement } from 'lit';
import './communication-mapping-editor.js';
export default class SlcCommunicationEditor extends LitElement {
    doc?: XMLDocument;
    get substation(): Element | null;
    gridSize: number;
    editCount: number;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
