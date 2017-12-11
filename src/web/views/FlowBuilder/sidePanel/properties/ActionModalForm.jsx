import React, { Component } from 'react'
import { Modal, Button, Radio, OverlayTrigger, Tooltip, Panel, Well } from 'react-bootstrap'
import Select from 'react-select'
import axios from 'axios'
import _ from 'lodash'

import ParametersTable from './ParametersTable'

const style = require('./style.scss')

export default class ActionModalForm extends Component {
  constructor(props) {
    super(props)

    this.state = {
      actionType: 'message',
      functionSuggestions: [],
      functionInputValue: '',
      messageInputValue: '',
      functionParams: {}
    }
  }

  componentWillReceiveProps(nextProps) {
    const { item } = nextProps

    if (this.props.show || !nextProps.show) {
      return
    }

    if (item) {
      this.setState({
        actionType: nextProps.item.type,
        functionInputValue: nextProps.item.functionName,
        messageInputValue: nextProps.item.message,
        functionParams: nextProps.item.parameters
      })
    } else {
      this.resetForm()
    }
    this.setState({ isEdit: Boolean(item) })
  }

  componentDidMount() {
    this.fetchAvailableFunctions()
  }

  fetchAvailableFunctions() {
    return axios.get('/flows/available_functions').then(({ data }) => {
      this.setState({ functionSuggestions: data.map(x => ({ label: x.name, value: x.name })) })
    })
  }

  onChangeType(type) {
    this.setState({ actionType: type })
  }

  resetForm() {
    this.setState({
      actionType: 'message',
      functionInputValue: '',
      messageInputValue: ''
    })
  }

  renderSectionCode() {
    const { functionSuggestions } = this.state

    const tooltip = (
      <Tooltip id="notSeeingFunction">
        Functions are registered in the code on the server-side. Please make sure that the file containing the functions
        has been properly registered using `bp.registerFunctions('./path/to/file.js')`. This file should return an
        object containing functions.
      </Tooltip>
    )

    const tooltip2 = (
      <Tooltip id="whatIsThis">
        You can provide function calls extra parameters if they have been coded to support them. You can generally
        ignore this for most functions. Please see the documentation to know more.
      </Tooltip>
    )

    const help = (
      <OverlayTrigger placement="bottom" overlay={tooltip}>
        <span className={style.tip}>Missing your function?</span>
      </OverlayTrigger>
    )

    const paramsHelp = (
      <OverlayTrigger placement="bottom" overlay={tooltip2}>
        <span className={style.tip}>What is this?</span>
      </OverlayTrigger>
    )

    const onParamsChange = params => {
      params = _.values(params).reduce((sum, n) => {
        if (n.key === '') {
          return sum
        }
        return { ...sum, [n.key]: n.value }
      }, {})
      this.setState({ functionParams: params })
    }

    const args = JSON.stringify(this.state.functionParams, null, 4)

    const callPreview = `${this.state.functionInputValue}(state, event, ${args})`

    return (
      <div>
        <h5>Function to invoke {help}</h5>
        <div className={style.section}>
          <Select
            name="functionToInvoke"
            value={this.state.functionInputValue}
            options={functionSuggestions}
            onChange={val => {
              this.setState({ functionInputValue: val && val.value })
            }}
          />
        </div>
        <h5>Function parameters {paramsHelp}</h5>
        <div className={style.section}>
          <ParametersTable
            ref={el => (this.parametersTable = el)}
            onChange={onParamsChange}
            value={this.state.functionParams}
          />
        </div>

        <h5>Preview</h5>
        <div className={style.section}>
          <pre>{callPreview}</pre>
        </div>
      </div>
    )
  }

  renderSectionMessage() {
    const handleChange = item => {
      this.setState({ messageInputValue: `say #!${item.id}` })
    }

    const tooltip = (
      <Tooltip id="howMessageWorks">
        You can type a regular message here or you can also provide a valid UMM bloc, for example "#help".
      </Tooltip>
    )

    const help = (
      <OverlayTrigger placement="bottom" overlay={tooltip}>
        <i className="material-icons">help</i>
      </OverlayTrigger>
    )

    return (
      <div>
        <h5>Message {help}:</h5>
        <div className={`${style.section} input-group`}>
          <input
            type="text"
            name="message"
            placeholder="Message to send"
            value={this.state.messageInputValue}
            disabled
            className="form-control"
          />
          <span className="input-group-btn">
            <button
              className="btn btn-default"
              type="button"
              onClick={() => window.botpress.pickContent({}, handleChange)}
            >
              Pick Content...
            </button>
          </span>
        </div>
      </div>
    )
  }

  render() {
    const props = this.props
    const noop = () => {}

    const onClose = props.onClose || noop
    const onSubmit = () => {
      const handler = props.onSubmit || noop
      this.resetForm()
      handler({
        type: this.state.actionType,
        functionName: this.state.functionInputValue,
        message: this.state.messageInputValue,
        parameters: this.state.functionParams
      })
    }

    return (
      <Modal animation={false} show={props.show} onHide={onClose} container={document.getElementById('app')}>
        <Modal.Header closeButton>
          <Modal.Title>{this.state.isEdit ? 'Edit' : 'Add new'} action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h5>The bot will:</h5>
          <div className={style.section}>
            <Radio checked={this.state.actionType === 'message'} onChange={this.onChangeType.bind(this, 'message')}>
              💬 Say something
            </Radio>
            <Radio checked={this.state.actionType === 'code'} onChange={this.onChangeType.bind(this, 'code')}>
              ⚡ Execute code
            </Radio>
          </div>

          {this.state.actionType === 'message' ? this.renderSectionMessage() : this.renderSectionCode()}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} bsStyle="primary">
            {this.state.isEdit ? 'Update' : 'Add'} Action (Alt+Enter)
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
}
