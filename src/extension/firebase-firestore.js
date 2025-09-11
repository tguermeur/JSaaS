/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Firebase Firestore SDK.
 * @externs
 */

/**
 * @namespace
 */
var firebase = {};

/**
 * @namespace
 */
firebase.firestore = {};

/**
 * @param {!firebase.app.App} app
 * @return {!firebase.firestore.Firestore}
 */
firebase.firestore = function(app) {};

/**
 * @typedef {{
 *   add: function(!firebase.firestore.DocumentData): !Promise<!firebase.firestore.DocumentReference>,
 *   delete: function(): !Promise<void>,
 *   get: function(): !Promise<!firebase.firestore.DocumentSnapshot>,
 *   set: function(!firebase.firestore.DocumentData, !firebase.firestore.SetOptions=): !Promise<void>,
 *   update: function(!firebase.firestore.UpdateData): !Promise<void>
 * }}
 */
firebase.firestore.DocumentReference;

/**
 * @typedef {{
 *   docs: !Array<!firebase.firestore.QueryDocumentSnapshot>,
 *   empty: boolean,
 *   metadata: !firebase.firestore.SnapshotMetadata,
 *   size: number
 * }}
 */
firebase.firestore.QuerySnapshot;

/**
 * @typedef {{
 *   hasPendingWrites: boolean,
 *   fromCache: boolean
 * }}
 */
firebase.firestore.SnapshotMetadata;

/**
 * @typedef {{
 *   exists: boolean,
 *   ref: !firebase.firestore.DocumentReference,
 *   id: string,
 *   metadata: !firebase.firestore.SnapshotMetadata,
 *   data: function(): !firebase.firestore.DocumentData
 * }}
 */
firebase.firestore.DocumentSnapshot;

/**
 * @typedef {{
 *   exists: boolean,
 *   ref: !firebase.firestore.DocumentReference,
 *   id: string,
 *   metadata: !firebase.firestore.SnapshotMetadata,
 *   data: function(): !firebase.firestore.DocumentData
 * }}
 */
firebase.firestore.QueryDocumentSnapshot;

/**
 * @typedef {Object}
 */
firebase.firestore.DocumentData;

/**
 * @typedef {Object}
 */
firebase.firestore.UpdateData;

/**
 * @typedef {{
 *   merge: (boolean|undefined)
 * }}
 */
firebase.firestore.SetOptions;

/**
 * @typedef {{
 *   serverTimestamp: function(): !firebase.firestore.FieldValue
 * }}
 */
firebase.firestore.FieldValue;

/**
 * @typedef {{
 *   collection: function(string): !firebase.firestore.CollectionReference,
 *   doc: function(string): !firebase.firestore.DocumentReference,
 *   enablePersistence: function(): !Promise<void>,
 *   settings: function(!firebase.firestore.Settings): void
 * }}
 */
firebase.firestore.Firestore;

/**
 * @typedef {{
 *   cacheSizeBytes: (number|undefined),
 *   host: (string|undefined),
 *   ignoreUndefinedProperties: (boolean|undefined),
 *   merge: (boolean|undefined),
 *   ssl: (boolean|undefined),
 *   timestampsInSnapshots: (boolean|undefined)
 * }}
 */
firebase.firestore.Settings;

/**
 * @typedef {{
 *   add: function(!firebase.firestore.DocumentData): !Promise<!firebase.firestore.DocumentReference>,
 *   doc: function(string): !firebase.firestore.DocumentReference,
 *   get: function(): !Promise<!firebase.firestore.QuerySnapshot>,
 *   limit: function(number): !firebase.firestore.Query,
 *   orderBy: function(string, !firebase.firestore.OrderByDirection=): !firebase.firestore.Query,
 *   where: function(string, !firebase.firestore.WhereFilterOp, any): !firebase.firestore.Query
 * }}
 */
firebase.firestore.CollectionReference;

/**
 * @typedef {{
 *   get: function(): !Promise<!firebase.firestore.QuerySnapshot>,
 *   limit: function(number): !firebase.firestore.Query,
 *   orderBy: function(string, !firebase.firestore.OrderByDirection=): !firebase.firestore.Query,
 *   where: function(string, !firebase.firestore.WhereFilterOp, any): !firebase.firestore.Query
 * }}
 */
firebase.firestore.Query;

/**
 * @typedef {string}
 */
firebase.firestore.OrderByDirection;

/**
 * @typedef {string}
 */
firebase.firestore.WhereFilterOp; 