import { combineReducers } from 'redux'
import _ from 'lodash'

import content from './content'
import flows from './flows'
import license from './license'
import ui from './ui'
import user from './user'
import bot from './bot'
import modules from './modules'
import rules from './rules'
import notifications from './notifications'

const bpApp = combineReducers({ content, flows, license, ui, user, bot, modules, rules, notifications })

export default bpApp

export const getCurrentFlow = state => state.flows.flowsByName[state.flows.currentFlow] || null

export const getCurrentFlowNode = state => {
  if (!state.flows || !state.flows.currentFlow || !state.flows.currentFlowNode) {
    return
  }

  const currentFlow = getCurrentFlow(state)
  return currentFlow && _.find(currentFlow.nodes, { id: state.flows.currentFlowNode })
}

export const getDirtyFlows = state => {
  if (!state.flows) {
    return []
  }

  const currentKeys = _.keys(state.flows.currentHashes)
  const initialKeys = _.keys(state.flows.initialHashes)
  const keys = _.union(currentKeys, initialKeys)

  const dirtyFlows = _.union(_.xor(keys, currentKeys), _.xor(keys, initialKeys))

  _.keys(state.flows.flowsByName).forEach(flow => {
    if (state.flows.initialHashes[flow] !== state.flows.currentHashes[flow]) {
      dirtyFlows.push(flow)
    }
  })

  return dirtyFlows
}

export const canFlowUndo = state => {
  return state.flows.currentSnapshotIndex < state.flows.snapshots.length
}

export const canFlowRedo = state => {
  return state.flows.currentSnapshotIndex > 0
}
