import React from 'react'
import { render } from 'react-dom'
import './scss/base.scss'
import Bootstrap from './bootstrap'
// import {createRoot} from "react-dom/client";

// let createdroot = false
// const rootNode = document.querySelector('#root')
// if (rootNode && !createdroot) {
//   createdroot = true
//   const root = createRoot(rootNode, {})
//   root.render(<React.StrictMode><Bootstrap/></React.StrictMode>)
// }

render(<React.StrictMode><Bootstrap/></React.StrictMode>, document.getElementById('root'))