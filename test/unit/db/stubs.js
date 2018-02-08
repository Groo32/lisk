/*
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */
'use strict';

const Promise = require('bluebird');

/**
 * @class PGPromiseStub
 */
class PGPromiseStub {
	/**
	 * @constructor
	 * @param {external:Database} db
	 * Database object from pg-promise, to be automatically stubbed.
	 */
	constructor(db) {
		this.db = db;
	}

	/**
	 * @method PGPromiseStub#intercept
	 * @description
	 * Helps testing SQL generated by a database method, it executes the method, while intercepting the SQL execution.
	 * If the method executes SQL at multiple points, it will be interrupted at the first point.
	 *
	 * @param {string} method
	 * Database method to be invoked, in the format of 'repoName.methodName'.
	 *
	 * @param params
	 * Value-formatting parameters to be passed into the database method.
	 *
	 * @returns {Promise<string>}
	 * Resolves with the query - SQL string that the method attempted to execute.
	 */
	intercept(method, params) {
		return new Promise((resolve, reject) => {
			const info = this.parseMethod(method);
			const opt = this.db.$config.options;
			const oldQuery = opt.query;
			let sql;
			opt.query = e => {
				sql = e.query;
				throw null;
			};
			info.method.func
				.call(info.repo.obj, ...params)
				.then(data => {
					throw new Error(
						`Method '${method}' resolved without trying to execute any query, with data: ${JSON.stringify(
							data
						)}`
					);
				})
				.catch(error => {
					if (error === null) {
						resolve(sql);
					} else {
						reject(error);
					}
				})
				.finally(() => {
					opt.query = oldQuery;
				});
		});
	}

	/**
	 * @method PGPromiseStub#execute
	 * @description
	 * Helps testing SQL generated by a database method, side-by-side with the data resolved by the method.
	 * If the method executes SQL at multiple points, only the first attempt will be captured.
	 *
	 * @param {string} method
	 * Database method to be invoked, in the format of 'repoName.methodName'.
	 *
	 * @param params
	 * Value-formatting parameters to be passed into the database method.
	 *
	 * @returns {Promise<{sql, data}>}
	 *  - Resolves with `{sql, data}` - SQL + resolved data
	 */
	execute(method, params) {
		return new Promise((resolve, reject) => {
			const info = this.parseMethod(method);
			const opt = this.db.$config.options;
			const oldQuery = opt.query;
			let sql;
			opt.query = e => {
				sql = e.query;
			};
			info.method.func
				.call(info.repo.obj, ...params)
				.then(data => {
					if (sql) {
						resolve({ sql, data });
					} else {
						throw new Error(
							`Method '${method}' resolved without trying to execute any query, with data: ${JSON.stringify(
								data
							)}`
						);
					}
				})
				.catch(reject)
				.finally(() => {
					opt.query = oldQuery;
				});
		});
	}

	/**
	 * @method PGPromiseStub#parseMethod
	 * @private
	 * @param {string} method
	 * @returns {{repo: {name: *|string, obj: *}, method: {name: *|string, func: *}}}
	 */
	parseMethod(method) {
		let names = '';
		if (method && typeof method === 'string') {
			names = method.split('.');
		}
		if (names.length !== 2 || !names[0] || !names[1]) {
			throw new TypeError(
				'Parameter "method" must have format "repoName.methodName".'
			);
		}
		if (!(names[0] in this.db)) {
			throw new TypeError(`Repository with name "${names[0]}" does not exist.`);
		}
		const repo = { name: names[0], obj: this.db[names[0]] };
		if (!(names[1] in repo.obj)) {
			throw new TypeError(
				`Method with name "${names[1]}" does not exist in repository "${
					repo.name
				}".`
			);
		}
		return { repo, method: { name: names[1], func: repo.obj[names[1]] } };
	}
}

module.exports = PGPromiseStub;

/**
 * @external Database
 * @see http://vitaly-t.github.io/pg-promise/Database.html
 */
