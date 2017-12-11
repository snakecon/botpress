import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import classnames from 'classnames'
import axios from 'axios'
import _ from 'lodash'

import { Grid, Row, Col, Alert } from 'react-bootstrap'

import Sidebar from './Sidebar'
import { fetchContentCategories, fetchContentMessages, upsertContentMessages, deleteContentMessages } from '~/actions'

import List from './List'
import CreateOrEditModal from './modal'

import ContentWrapper from '~/components/Layout/ContentWrapper'
import PageHeader from '~/components/Layout/PageHeader'

const style = require('./style.scss')

const MESSAGES_PER_PAGE = 20

class ContentView extends Component {
  state = {
    showModal: false,
    modifyId: null,
    selectedId: 'all',
    page: 1,
    contentToEdit: null
  }

  componentDidMount() {
    this.props.fetchContentCategories()
    this.fetchCategoryMessages(this.state.selectedId)
  }

  fetchCategoryMessages(id) {
    return this.props.fetchContentMessages({
      id,
      count: MESSAGES_PER_PAGE,
      from: (this.state.page - 1) * MESSAGES_PER_PAGE,
      searchTerm: this.state.searchTerm
    })
  }

  currentCategoryId() {
    return this.state.modifyId
      ? _.find(this.props.messages, { id: this.state.modifyId }).categoryId
      : this.state.selectedId
  }

  handleCloseModal = () => {
    this.setState({
      showModal: false,
      modifyId: null,
      contentToEdit: null
    })
  }

  handleCreateNew = () => {
    this.setState({
      showModal: true,
      modifyId: null,
      contentToEdit: {}
    })
  }

  handleUpsert = () => {
    const categoryId = this.currentCategoryId()
    this.props
      .upsertContentMessages({ categoryId, formData: this.state.contentToEdit, modifyId: this.state.modifyId })
      .then(() => this.fetchCategoryMessages(this.state.selectedId))
      .then(() => this.setState({ showModal: false }))
  }

  handleFormEdited = data => {
    this.setState({ contentToEdit: data })
  }

  handleCategorySelected = id => {
    this.fetchCategoryMessages(id)
    this.setState({ selectedId: id })
  }

  handleDeleteSelected = ids => {
    this.props.deleteContentMessages(ids).then(() => this.fetchCategoryMessages(this.state.selectedId))
  }

  handleModalShowForEdit = id => {
    const contentToEdit = _.find(this.props.messages, { id }).formData
    this.setState({ modifyId: id, showModal: true, contentToEdit })
  }

  handleRefresh = () => {
    this.fetchCategoryMessages(this.state.selectedId || 'all')
  }

  handlePrevious = () => {
    this.setState({ page: this.state.page - 1 || 1 })
    setImmediate(() => this.fetchCategoryMessages(this.state.selectedId))
  }

  handleNext = () => {
    this.setState({ page: this.state.page + 1 })
    setImmediate(() => this.fetchCategoryMessages(this.state.selectedId))
  }

  handleSearch = input => {
    this.setState({ searchTerm: input })
    setImmediate(() => this.fetchCategoryMessages(this.state.selectedId))
  }

  renderBody() {
    const { selectedId = 'all', modifyId, contentToEdit } = this.state
    const selectedCategory = _.find(this.props.categories, { id: this.currentCategoryId() })

    const classNames = classnames(style.content, 'bp-content')

    if (!this.props.categories.length) {
      return (
        <div className={classNames}>
          <Alert bsStyle="warning">
            <strong>We think you don't have any content types defined.</strong> Please&nbsp;
            <a href="https://botpress.io/docs/foundamentals/content/" target="_blank">
              <strong>read the docs</strong>
            </a>
            &nbsp;to see how you can make use of this feature.
          </Alert>
        </div>
      )
    }

    return (
      <div>
        <Grid className={classNames}>
          <Row>
            <Col xs={3}>
              <Sidebar
                categories={this.props.categories}
                selectedId={selectedId}
                handleAdd={this.handleCreateNew}
                handleCategorySelected={this.handleCategorySelected}
              />
            </Col>
            <Col xs={9}>
              <List
                page={this.state.page}
                count={
                  this.state.selectedId === 'all'
                    ? _.sumBy(this.props.categories, 'count') || 0
                    : _.find(this.props.categories, { id: this.state.selectedId }).count
                }
                messagesPerPage={MESSAGES_PER_PAGE}
                messages={this.props.messages || []}
                searchTerm={this.state.searchTerm}
                handlePrevious={this.handlePrevious}
                handleNext={this.handleNext}
                handleRefresh={this.handleRefresh}
                handleEdit={this.handleModalShowForEdit}
                handleDeleteSelected={this.handleDeleteSelected}
                handleSearch={this.handleSearch}
              />
            </Col>
          </Row>
        </Grid>
        <CreateOrEditModal
          show={this.state.showModal}
          schema={(selectedCategory && selectedCategory.schema.json) || {}}
          uiSchema={(selectedCategory && selectedCategory.schema.ui) || {}}
          formData={contentToEdit}
          handleCreateOrUpdate={this.handleUpsert}
          handleEdit={this.handleFormEdited}
          handleClose={this.handleCloseModal}
        />
      </div>
    )
  }

  render() {
    return (
      <ContentWrapper>
        <PageHeader>Content Manager</PageHeader>
        {this.renderBody()}
      </ContentWrapper>
    )
  }
}

const mapStateToProps = state => ({
  categories: state.content.categories,
  messages: state.content.currentMessages
})
const mapDispatchToProps = dispatch =>
  bindActionCreators(
    { fetchContentCategories, fetchContentMessages, upsertContentMessages, deleteContentMessages },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(ContentView)
