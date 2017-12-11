import { handleActions } from 'redux-actions'
import reduceReducers from 'reduce-reducers'
import _ from 'lodash'
import nanoid from 'nanoid'

import { hashCode } from '~/util'

import {
  requestFlows,
  requestSaveFlows,
  receiveSaveFlows,
  receiveFlows,
  switchFlow,
  updateFlow,
  renameFlow,
  updateFlowNode,
  switchFlowNode,
  setDiagramAction,
  createFlowNode,
  copyFlowNode,
  pasteFlowNode,
  createFlow,
  deleteFlow,
  duplicateFlow,
  removeFlowNode,
  flowEditorUndo,
  flowEditorRedo,
  linkFlowNodes
} from '~/actions'

const SNAPSHOT_SIZE = 25

const defaultState = {
  flowsByName: {},
  fetchingFlows: false,
  currentFlow: null,
  currentFlowNode: null,
  currentDiagramAction: null,
  currentSnapshotIndex: 0,
  snapshots: [],
  nodeInBuffer: null
}

function computeFlowsHash(state) {
  const hashAction = (hash, action) => {
    if (_.isArray(action)) {
      action.forEach(c => {
        if (_.isString(c)) {
          hash += c
        } else {
          hash += c.node
          hash += c.condition
        }
      })
    } else {
      hash += 'null'
    }

    return hash
  }

  return _.values(state.flowsByName).reduce((obj, curr) => {
    if (!curr) {
      return obj
    }

    let buff = ''
    buff += curr.name
    buff += curr.startNode

    if (curr.catchAll) {
      buff = hashAction(buff, curr.catchAll.onReceive)
      buff = hashAction(buff, curr.catchAll.onEnter)
      buff = hashAction(buff, curr.catchAll.next)
    }

    _.orderBy(curr.nodes, 'id').forEach(node => {
      buff = hashAction(buff, node.onReceive)
      buff = hashAction(buff, node.onEnter)
      buff = hashAction(buff, node.next)
      buff += node.id
      buff += node.name
      buff += node.x
      buff += node.y
    })

    _.orderBy(curr.links, l => l.source + l.target).forEach(link => {
      buff += link.source
      buff += link.target
      link.points &&
        link.points.forEach(p => {
          buff += p.x
          buff += p.y
        })
    })

    obj[curr.name] = hashCode(buff)
    return obj
  }, {})
}

function updateCurrentHash(state) {
  return { ...state, currentHashes: computeFlowsHash(state) }
}

function createSnapshot(state) {
  const snapshot = {
    activeFlow: state.currentFlow,
    activeFlowNode: state.currentFlowNode,
    flowsByName: Object.assign({}, state.flowsByName)
  }

  const lastSnapshot = _.head(state.snapshots)

  let snapshots = _.take(state.snapshots, SNAPSHOT_SIZE)

  if (
    state.currentSnapshotIndex === 0 &&
    state.snapshots.length > 1 &&
    lastSnapshot &&
    snapshot.activeFlow === lastSnapshot.activeFlow &&
    (!!snapshot.activeFlowNode && snapshot.activeFlowNode === lastSnapshot.activeFlowNode)
  ) {
    snapshots = _.drop(snapshots, 1) // We merge the current and last snapshots
  }

  return {
    ...state,
    snapshots: [snapshot, ...snapshots],
    currentSnapshotIndex: 0
  }
}

function applySnapshot(state, snapshot) {
  return {
    ...state,
    currentFlow: snapshot.activeFlow,
    currentFlowNode: snapshot.activeFlowNode,
    flowsByName: snapshot.flowsByName
  }
}

function copyName(siblingNames, nameToCopy) {
  let copies = siblingNames.filter(name => name.startsWith(`${nameToCopy}-copy`))

  if (!copies.length) {
    return `${nameToCopy}-copy`
  }

  let i = 1
  while (true) {
    if (!copies.find(name => name === `${nameToCopy}-copy-${i}`)) {
      return `${nameToCopy}-copy-${i}`
    } else {
      i += 1
    }
  }
}

function doRenameFlow({ flow, name, flows }) {
  return _.reduce(
    flows,
    function(obj, f) {
      if (f.name === flow) {
        f.name = name
        f.location = name
      }

      if (f.nodes) {
        let json = JSON.stringify(f.nodes)
        json = json.replace(flow, name)
        f.nodes = JSON.parse(json)
      }

      obj[f.name] = f

      return obj
    },
    {}
  )
}

function doCreateNewFlow(name) {
  return {
    version: '0.1',
    name: name,
    location: name,
    startNode: 'entry',
    catchAll: {},
    links: [],
    nodes: [
      {
        id: nanoid(),
        name: 'entry',
        onEnter: [],
        onReceive: null,
        next: [],
        x: 100,
        y: 100
      }
    ]
  }
}

// *****
// Reducer that deals with non-recordable (no snapshot taking)
// *****

let reducer = handleActions(
  {
    [requestFlows]: state => ({
      ...state,
      fetchingFlows: true
    }),

    [receiveFlows]: (state, { payload }) => ({
      ...state,
      fetchingFlows: false,
      flowsByName: payload,
      currentFlow: state.currentFlow || _.first(_.keys(payload))
    }),

    [requestSaveFlows]: state => ({
      ...state,
      savingFlows: true
    }),

    [receiveSaveFlows]: state => ({
      ...state,
      savingFlows: false
    }),

    [switchFlowNode]: (state, { payload }) => ({
      ...state,
      currentFlowNode: payload
    }),

    [switchFlow]: (state, { payload }) => {
      return {
        ...state,
        currentFlowNode: null,
        currentFlow: payload
      }
    },

    [setDiagramAction]: (state, { payload }) => ({
      ...state,
      currentDiagramAction: payload
    })
  },
  defaultState
)

// *****
// Reducer that creates snapshots of the flows (for undo / redo)
// *****

reducer = reduceReducers(
  reducer,
  handleActions(
    {
      [updateFlow]: createSnapshot,
      [renameFlow]: createSnapshot,
      [updateFlowNode]: createSnapshot,
      [createFlowNode]: createSnapshot,
      [linkFlowNodes]: createSnapshot,
      [createFlow]: createSnapshot,
      [deleteFlow]: createSnapshot,
      [duplicateFlow]: createSnapshot,
      [removeFlowNode]: createSnapshot,

      [flowEditorUndo]: state => {
        if (_.isEmpty(state.snapshots) || state.snapshots.length <= state.currentSnapshotIndex) {
          return state
        }

        const snapshot = state.snapshots[state.currentSnapshotIndex]

        return {
          ...applySnapshot(state, snapshot),
          currentSnapshotIndex: state.currentSnapshotIndex + 1
        }
      },

      [flowEditorRedo]: state => {
        if (state.currentSnapshotIndex <= 0) {
          return state
        }
        const snapshot = state.snapshots[state.currentSnapshotIndex - 1]
        return {
          ...applySnapshot(state, snapshot),
          currentSnapshotIndex: state.currentSnapshotIndex - 1
        }
      }
    },
    defaultState
  )
)

reducer = reduceReducers(
  reducer,
  handleActions(
    {
      [renameFlow]: (state, { payload }) => ({
        ...state,
        flowsByName: doRenameFlow({
          flow: state.currentFlow,
          name: payload,
          flows: _.values(state.flowsByName)
        }),
        currentFlow: payload
      }),

      [updateFlow]: (state, { payload }) => {
        const currentFlow = state.flowsByName[state.currentFlow]
        const nodes = !payload.links
          ? currentFlow.nodes
          : currentFlow.nodes.map(node => {
              const nodeLinks = payload.links.filter(link => link.source === node.id)
              let next = node.next.map((value, index) => {
                const link = nodeLinks.find(link => Number(link.sourcePort.replace('out', '')) === index)
                const targetNode = _.find(currentFlow.nodes, { id: (link || {}).target })
                let remapNode = ''

                if (value.includes('.flow.json') || value === 'END') {
                  remapNode = value
                }

                return { ...value, node: (targetNode && targetNode.name) || remapNode }
              })

              return { ...node, next, lastModified: new Date() }
            })

        return {
          ...state,
          flowsByName: {
            ...state.flowsByName,
            [state.currentFlow]: { ...currentFlow, nodes, ...payload }
          }
        }
      },

      [createFlow]: (state, { payload: name }) => ({
        ...state,
        flowsByName: {
          ...state.flowsByName,
          [name]: doCreateNewFlow(name)
        },
        currentFlow: name,
        currentFlowNode: null
      }),

      [deleteFlow]: (state, { payload: name }) => ({
        ...state,
        currentFlow: state.currentFlow === name ? null : state.currentFlow,
        currentFlowNode: state.currentFlow === name ? null : state.currentFlowNode,
        flowsByName: _.omit(state.flowsByName, name)
      }),

      [duplicateFlow]: (state, { payload: { flowNameToDuplicate, name } }) => {
        return {
          ...state,
          flowsByName: {
            ...state.flowsByName,
            [name]: {
              ...state.flowsByName[flowNameToDuplicate],
              name,
              location: name,
              nodes: state.flowsByName[flowNameToDuplicate].nodes.map(node => ({
                ...node,
                id: nanoid()
              }))
            }
          },
          currentFlow: name,
          currentFlowNode: null
        }
      },

      [updateFlowNode]: (state, { payload }) => {
        const currentFlow = state.flowsByName[state.currentFlow]
        const currentNode = _.find(state.flowsByName[state.currentFlow].nodes, { id: state.currentFlowNode })
        const needsUpdate = name => name === (currentNode || {}).name && payload.name
        return {
          ...state,
          flowsByName: {
            ...state.flowsByName,
            [state.currentFlow]: {
              ...currentFlow,
              startNode: needsUpdate(currentFlow.startNode) ? payload.name : currentFlow.startNode,
              nodes: currentFlow.nodes.map(node => {
                if (node.id !== state.currentFlowNode) {
                  return {
                    ...node,
                    next: node.next.map(transition => ({
                      ...transition,
                      node: needsUpdate(transition.node) ? payload.name : transition.node
                    }))
                  }
                }

                return { ...node, ...payload, lastModified: new Date() }
              })
            }
          }
        }
      },

      [linkFlowNodes]: (state, { payload }) => {
        const flow = state.flowsByName[state.currentFlow]

        const nodes = flow.nodes.map(node => {
          if (node.id !== payload.node) {
            return node
          }

          const clone = Object.assign({}, node)
          clone.next[payload.index].node = payload.target

          return clone
        })

        return {
          ...state,
          flowsByName: {
            ...state.flowsByName,
            [state.currentFlow]: {
              ...flow,
              nodes: nodes
            }
          }
        }
      },

      [removeFlowNode]: (state, { payload }) => ({
        ...state,
        flowsByName: {
          ...state.flowsByName,
          [state.currentFlow]: {
            ...state.flowsByName[state.currentFlow],
            nodes: state.flowsByName[state.currentFlow].nodes.filter(node => {
              return node.id !== payload
            })
          }
        }
      }),

      [copyFlowNode]: state => ({
        ...state,
        nodeInBuffer: { ..._.find(state.flowsByName[state.currentFlow].nodes, { id: state.currentFlowNode }) }
      }),

      [pasteFlowNode]: state => {
        const currentFlow = state.flowsByName[state.currentFlow]
        const newNodeId = nanoid()
        return {
          ...state,
          currentFlowNode: newNodeId,
          nodeInBuffer: null,
          flowsByName: {
            ...state.flowsByName,
            [state.currentFlow]: {
              ...currentFlow,
              nodes: [
                ...currentFlow.nodes,
                {
                  ...state.nodeInBuffer,
                  id: newNodeId,
                  name: copyName(currentFlow.nodes.map(({ name }) => name), state.nodeInBuffer.name),
                  lastModified: new Date(),
                  x: 0,
                  y: 0
                }
              ]
            }
          }
        }
      },

      [createFlowNode]: (state, { payload }) => ({
        ...state,
        flowsByName: {
          ...state.flowsByName,
          [state.currentFlow]: {
            ...state.flowsByName[state.currentFlow],
            nodes: [
              ...state.flowsByName[state.currentFlow].nodes,
              _.merge(
                {
                  id: nanoid(),
                  name: 'node-' + nanoid(4),
                  x: 0,
                  y: 0,
                  next: [],
                  onEnter: [],
                  onReceive: null
                },
                payload
              )
            ]
          }
        }
      })
    },
    defaultState
  )
)

// *****
// Reducer that creates the 'initial hash' of flows (for dirty detection)
// Resets the 'dirty' state when a flow is saved
// *****

reducer = reduceReducers(
  reducer,
  handleActions(
    {
      [receiveFlows]: state => {
        const hashes = computeFlowsHash(state)
        return { ...state, currentHashes: hashes, initialHashes: hashes }
      },

      [receiveSaveFlows]: state => {
        const hashes = computeFlowsHash(state)
        return { ...state, currentHashes: hashes, initialHashes: hashes }
      },

      [updateFlow]: updateCurrentHash,
      [renameFlow]: updateCurrentHash,
      [linkFlowNodes]: updateCurrentHash,
      [updateFlowNode]: updateCurrentHash,

      [createFlowNode]: updateCurrentHash,
      [createFlow]: updateCurrentHash,
      [deleteFlow]: updateCurrentHash,
      [duplicateFlow]: updateCurrentHash,
      [removeFlowNode]: updateCurrentHash
    },
    defaultState
  )
)

export default reducer
