import _ from 'underscore';
import Promise from 'bluebird';
import HandlerBase from './handler_base';


/**
 * Represents a proxied HTTP request for which the response is generated by custom user function.
 * This is useful e.g. when providing access to external APIs via HTTP proxy interface.
 */
export default class HandlerCustomResponse extends HandlerBase {
    constructor(options) {
        super(options);

        this.customResponseFunc = options.customResponseFunc;
        if (!this.customResponseFunc) throw new Error('The "customResponseFunc" option is required');
    }

    run() {
        const reqOpts = this.trgParsed;
        reqOpts.method = this.srcRequest.method;
        reqOpts.headers = {};

        Promise.resolve()
            .then(() => {
                const opts = _.pick(this, 'srcRequest', 'trgParsed');
                return this.customResponseFunc(opts);
            })
            .then((customResponse) => {
                if (this.isClosed) return;

                const statusCode = customResponse.statusCode || 200;
                const length = customResponse.body ? customResponse.body.length : null;

                this.log(`Received custom user response (${statusCode}, length: ${length}, encoding: ${customResponse.encoding})`);

                // Forward custom response to source
                this.srcResponse.statusCode = statusCode;

                _.each(customResponse.headers, (value, key) => {
                    this.srcResponse.setHeader(key, value);
                });

                return new Promise((resolve, reject) => {
                    this.srcGotResponse = true;
                    this.srcResponse.end(customResponse.body, customResponse.encoding, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            })
            .then(() => {
                this.log(`Custom response sent to source (${response.statusCode})`);
            })
            .catch((err) => {
                if (this.isClosed) return;
                this.log(`Custom response function failed: ${err.stack || err}`);
                this.fail(err);
            });
    }
}