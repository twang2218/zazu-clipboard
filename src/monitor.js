const readableFormat = require('./lib/readableFormat')
const CappedClient = require('./lib/cappedClient')

module.exports = (pluginContext) => {
  const { cwd, clipboard, console } = pluginContext

  isTransient = () => {
    const badTypes = [
      'de.petermaurer.TransientPasteboardType',
      'com.typeit4me.clipping',
      'Pasteboard generator type',
      'com.agilebits.onepassword',
      'org.nspasteboard.TransientType',
      'org.nspasteboard.ConcealedType',
      'org.nspasteboard.AutoGeneratedType',
    ]
    return badTypes.find((badType) => {
      return clipboard.has(badType)
    })
  }

  getClip = (ignoreImages) => {
    const clip = {}
    if (ignoreImages) {
      clip.type = 'text'
    } else {
      clip.type = clipboard.readImage().isEmpty() ? 'text' : 'image'
    }

    if (clip.type === 'image') {
      const image = clipboard.readImage()
      const dimensions = image.getSize()
      const size = readableFormat(image.toDataURL().length * 0.75)
      clip.title = `Image: ${dimensions.width}x${dimensions.height} (${size.value}${size.unit})`
      clip.raw = image.toDataURL()
    } else {
      clip.raw = clipboard.readText()
    }
    return clip
  }

  let lastClip
  monitor = (env = {}) => {
    return new Promise((resolve, reject) => {
      if (isTransient()) {
        resolve()
      } else {
        const clip = getClip(env.ignoreImages)
        if (!lastClip || lastClip.type !== clip.type || lastClip.raw !== clip.raw) {
          lastClip = clip
          const clipCollection = CappedClient.init(cwd, env)
          resolve(clipCollection.upsert(clip))
        } else {
          resolve()
        }
      }
    })
  }

  //  As there is a performance hit of clipboard on Linux platform,
  //  Here we let Linux have more interval than other platform by default.
  //  See also: https://github.com/tinytacoteam/zazu/issues/189
  const DEFAULT_INTERVAL = (process.platform === 'linux' ? 3000 : 1000)
  //  Let the minimum interval be 250ms, which is a little bit higher than
  //  default minimum plugin system interval 100ms, for less CPU intense.
  const MINIMUM_INTERVAL = 250

  //  We use a loop here to provide user the ability to customize the interval.
  //  it will keep looping unless got an exception.
  start = (env = {}) => new Promise((resolve) => {
      //  interval value check
      let interval = parseInt(env.updateInterval, 10)
      if (isNaN(interval)) {
        interval = DEFAULT_INTERVAL
      } else if (interval < MINIMUM_INTERVAL) {
        interval = MINIMUM_INTERVAL
      }
      setTimeout(resolve, interval)
    })
    .then(() => monitor(env))
    .then(() => start(env))

  return start
}
