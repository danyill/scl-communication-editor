import { LitElement } from 'lit';
import '@material/mwc-fab';
import './jsplump-diagram.js';
import './sld-editor.js';
export default class SclCommEditor extends LitElement {
    doc: XMLDocument;
    /** SCL change indicator */
    editCount: number;
    gridSize: number;
    zoomIn(): void;
    zoomOut(): void;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
