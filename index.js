'use strict';

module.exports = function(logFn) {
  var stats = {
    delay: 0,
    maxDelay: 0,
    connectionsStart: 0,
    connectionsEnd: 0,
    avgReqDuration: 0,
    reqCount: 0
  },
    start = time(),
    checkInterval = 50,
    timeout

  if (!logFn) {
    logFn = function(data) {
      console.log(data)
    }
  }

  scheduleCheck(checkInterval)

  return function(req, res, next) {
    req.__lag_detector_requestStart = time()
    res.on('finish', logStatus)
    res.on('close', logStatus)

    stats.connectionsStart += 1
    stats.connectionsEnd += 1
    next()

    function logStatus() {
      res.removeListener('finish', logStatus)
      res.removeListener('close', logStatus)
      req.__lag_detector_reqDuration = time() - req.__lag_detector_requestStart

      stats.reqCount += 1
      stats.avgReqDuration += (req.__lag_detector_reqDuration - stats.avgReqDuration) / stats.reqCount
      log(req, res)

      stats.connectionsStart -= 1
      stats.connectionsEnd -= 1
      checkInterval = stats.avgReqDuration / 4

      if (stats.connectionsEnd <= 0) {
        stats.maxDelay = 0
      }
    }
  }

  function check(ms) {
    clearTimeout(timeout)
    var t = time(),
        lag = t - start - ms

    stats.maxDelay = Math.max(stats.maxDelay, lag)
    stats.delay = Math.max(0, lag)

    start = t
    scheduleCheck(checkInterval)
  }

  function scheduleCheck(checkInterval) {
    timeout = setTimeout(function() {
      check(checkInterval)
    }, checkInterval)
    timeout.unref()
  }

  function log(req, res) {
    logFn({
      reqDuration: req.__lag_detector_reqDuration,
      reqDurationAvg: stats.avgReqDuration,
      reqCountOnStart: stats.connectionsStart,
      reqCountOnEnd: stats.connectionsEnd,
      loopMaxDelay: stats.maxDelay,
      loopLastDelay: stats.delay,
      checkInterval: checkInterval
    }, req, res)
  }
}

function time() {
  var t = process.hrtime()
  return (t[0] * 1e3) + (t[1] / 1e6)
}
