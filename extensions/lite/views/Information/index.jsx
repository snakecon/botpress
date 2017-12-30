import React, { Component } from 'react'
import { Row, Col } from 'react-bootstrap'

import InformationComponent from '~/components/Information'
import HeroComponent from '~/components/Hero'

class InformationHeroRowComponent extends Component {
  render() {
    return (
      <Row>
        <Col sm={12} md={12}>
          <InformationComponent />
        </Col>
      </Row>
    )
  }
}

export default InformationHeroRowComponent
