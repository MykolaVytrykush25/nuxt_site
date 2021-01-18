import { createRenderer } from 'vue-bundle-renderer'
import devalue from '@nuxt/devalue'
import config from './config'
// @ts-ignore
import { renderToString } from '~renderer'
// @ts-ignore
import server from '~build/dist/server/server'
// @ts-ignore
import clientManifest from '~build/dist/server/client.manifest.json'
// @ts-ignore
import htmlTemplate from '~build/views/document.template.js'

const renderer = createRenderer(server, {
  clientManifest,
  renderToString
})

const STATIC_ASSETS_BASE = process.env.NUXT_STATIC_BASE + '/' + process.env.NUXT_STATIC_VERSION
const PAYLOAD_JS = '/payload.js'

export async function renderMiddleware (req, res) {
  let url = req.url

  // payload.json request detection
  let isPayloadReq = false
  if (url.startsWith(STATIC_ASSETS_BASE) && url.endsWith(PAYLOAD_JS)) {
    isPayloadReq = true
    url = url.substr(STATIC_ASSETS_BASE.length, url.length - STATIC_ASSETS_BASE.length - PAYLOAD_JS.length)
  }

  const ssrContext = {
    url,
    runtimeConfig: {
      public: config.public,
      private: config.private
    },
    ...(req.context || {})
  }
  const rendered = await renderer.renderToString(ssrContext)
  // TODO: nuxt3 should not reuse `nuxt` property for different purpose!
  const payload = ssrContext.payload /* nuxt 3 */ || ssrContext.nuxt /* nuxt 2 */

  if (process.env.NUXT_FULL_STATIC) {
    payload.staticAssetsBase = STATIC_ASSETS_BASE
  }

  let data
  if (isPayloadReq) {
    data = renderPayload(payload, url)
    res.setHeader('Content-Type', 'text/javascript;charset=UTF-8')
  } else {
    data = renderHTML(payload, rendered, ssrContext)
    res.setHeader('Content-Type', 'text/html;charset=UTF-8')
  }

  const error = ssrContext.nuxt && ssrContext.nuxt.error
  res.statusCode = error ? error.statusCode : 200
  res.end(data, 'utf-8')
}

function renderHTML (payload, rendered, ssrContext) {
  const state = `<script>window.__NUXT__=${devalue(payload)}</script>`
  const _html = rendered.html

  return htmlTemplate({
    HTML_ATTRS: '',
    HEAD_ATTRS: '',
    BODY_ATTRS: '',
    HEAD: rendered.renderResourceHints() + rendered.renderStyles() + (ssrContext.styles || ''),
    APP: _html + state + rendered.renderScripts()
  })
}

function renderPayload (payload, url) {
  return `__NUXT_JSONP__("${url}", ${devalue(payload)})`
}
