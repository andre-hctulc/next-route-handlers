export class ParamTypeError extends TypeError {
    constructor(paramName: string, required?: boolean) {
        super(`Invalid type received. At parameter '${paramName}'${required ? ". Required parameter missing" : ""}`);
    }
}
