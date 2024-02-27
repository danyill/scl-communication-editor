import { LitElement } from 'lit';
import './test-js-plump.js';
export default class ZeroLine extends LitElement {
    doc: XMLDocument;
    /** SCL change indicator */
    editCount: number;
    render(): import("lit-html").TemplateResult<1>;
}
