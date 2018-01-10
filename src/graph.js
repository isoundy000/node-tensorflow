// graph.js
// Defines the Graph class.
//

'use strict';

const api = require('./interop/api'),
      fs = require('fs');

function loadGraph(protobuf) {
  let graphDefBuffer = api.TF_NewBufferFromString(protobuf, protobuf.length);
  let graphDefOptions = api.TF_NewImportGraphDefOptions();

  let graphHandle = api.TF_NewGraph();
  let status = api.TF_NewStatus();
  api.TF_GraphImportGraphDef(graphHandle, graphDefBuffer, graphDefOptions, status);

  let code = api.TF_GetCode(status);

  api.TF_DeleteStatus(status);
  api.TF_DeleteImportGraphDefOptions(graphDefOptions);
  api.TF_DeleteBuffer(graphDefBuffer);

  if (code === api.StatusCodes.ok) {
    return new Graph(graphHandle);
  }
  else {
    api.TF_DeleteGraph(graphHandle);
    throw new Error('Invalid GraphDef');
  }
}

class Graph extends api.Reference {

  constructor(handle) {
    super(handle, api.TF_DeleteGraph);
    this._ops = {};
  }

  get ops() {
    return this._ops;
  }

  loadOperations(operations) {
    this.ensureValid();

    let unresolvedOps = null;
    for (let alias in operations) {
      let name = operations[alias];
      let op = api.TF_GraphOperationByName(this._handle, name);

      if (op && !op.isNull()) {
        this._ops[alias] = op;
      }
      else {
        unresolvedOps = unresolvedOps || {};
        unresolvedOps[alias] = name;
      }
    }

    return unresolvedOps;
  }

  static fromGraphDef(graphDef, operations) {
    let protobuf = null;
    if (graphDef.constructor == String) {
      protobuf = fs.readFileSync(graphDef);
    }
    else if (Buffer.isBuffer(graphDef)) {
      protobuf = graphDef;
    }
    else {
      let ProtobufWriter = require('pbf');

      let writer = new ProtobufWriter();
      api.Protos.GraphDef.write(graphDef, writer);

      protobuf = writer.finish();
    }

    let graph = loadGraph(protobuf);

    if (operations) {
      graph.loadOperations(operations);
    }

    return graph;
  }
}


module.exports = Graph;
