/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

const chai = require('chai')
chai.should()
const expect = chai.expect
chai.use(require('chai-as-promised'))
chai.use(require('chai-things'))
const sinon = require('sinon')

const CLOUD_CONFIG = require('./config')
const _ = require('lodash')

describe('Composer wallet implementation', () => {

  describe('Wrong Config settings', () => {

    CLOUD_CONFIG.wrongConfigs.forEach((cfg) => {
      it('should fail to create with faulty config', () => {
        (() => {
          CLOUD_CONFIG.getStore(cfg.c)
        }).should.throw(Error, cfg.text)
      })
    })
  })

  describe('Correct Config settings',  () => {
    CLOUD_CONFIG.correctConfigs.forEach((cfg) => {
      describe('Local MongoDB', () => {
        let sandbox
        let wallet
        beforeEach(async () => {
          sandbox = sinon.sandbox.create()
          let config = cfg
          await CLOUD_CONFIG.clean(config)
          wallet = CLOUD_CONFIG.getStore(config)
        })

        afterEach(() => {
          sandbox.restore()
          wallet = null
        })

        describe('#zipFile', async () => {
          it('should store a zip file', async () => {
            const fs = require('fs')

            try {
              const zipFile = fs.readFileSync('test/test.zip')
              await wallet.put('zipFile', zipFile)
              const result = await wallet.get('zipFile')
              expect(result).to.be.instanceof(Buffer)
              return result.should.deep.equal(zipFile)
            } catch (error) {
              error.message.should.be.equal('')
            }
          })
        })

        describe('#listNames', async () => {
          it('should return empty list for nothing present', async () => {
            let result = await wallet.listNames()
            return expect(result).to.be.an('array').that.is.empty
          })

          it('should return correctly populated array for several elements', async () => {
            await wallet.put('Batman-Original', 'Breathe in your fears. Face them. To conquer fear, you must become fear.')
            await wallet.put('Batman-Reloaded', 'It\'s not who I am underneath, but what I do that defines me')

            let result = await wallet.listNames()
            let expected = ['Batman-Original', 'Batman-Reloaded']

            expect(result).to.be.an('array')
            expect(result.length).to.equal(2)
            return expect(result).to.have.same.members(expected)
          })
        })

        describe('#get', async () => {
          it('should return reject for nothing present', async () => {
            return wallet.get('nonexistant').should.eventually.be.rejectedWith(/does not exist/)
          })

          it('should return correct error for missing key name', async () => {
            return wallet.get().should.eventually.be.rejectedWith(/Name must be specified/)
          })
        })

        describe('#getAll', async () => {
          it('should return empty map for nothing present', async () => {
            let result = await wallet.getAll()
            expect(result).to.be.an('map')
            return expect(result.size).to.equal(0)
          })

          it('should return correctly populated map for several elements', async () => {
            await wallet.put('Batman-Original', 'Breathe in your fears. Face them. To conquer fear, you must become fear.')
            await wallet.put('Batman-Reloaded', 'It\'s not who I am underneath, but what I do that defines me')

            let result = await wallet.getAll()
            expect(result).to.be.an('map')
            expect(result.size).to.equal(2)
            expect(result.get('Batman-Original')).to.equal('Breathe in your fears. Face them. To conquer fear, you must become fear.')
            return expect(result.get('Batman-Reloaded')).to.equal('It\'s not who I am underneath, but what I do that defines me')
          })
        })

        describe('#contains', async () => {
          it('should return correct error for missing key name', async () => {
            return wallet.contains().should.eventually.be.rejectedWith(/Name must be specified/)
          })

          it('should return false for nothing present', async () => {
            return wallet.contains('nonexistant').should.eventually.be.false
          })

          it('should return true for present', async () => {
            await wallet.put('IExist', 'I think therefore I\'ve got a headache')
            return wallet.contains('IExist').should.eventually.be.true
          })
        })

        describe('#remove', async () => {
          it('should return correct error for missing key name', async () => {
            return wallet.remove().should.eventually.be.rejectedWith(/Name must be specified/)
          })

          it('should return without error for those that don\'t exist', async () => {
            return wallet.remove('nonexistant').should.eventually.be.fulfilled
          })

          it('should return false for nothing present', async () => {
            await wallet.put('IExist', 'I think therefore I\'ve got a headache')
            await wallet.remove('IExist')
            return wallet.contains('IExist').should.eventually.be.false
          })
        })

        describe('#put', async () => {
          it('should return correct error for missing key name', async () => {
            return wallet.put().should.eventually.be.rejectedWith(/Name must be specified/)
          })

          it('should put a string and get it back', async () => {
            await wallet.put('Batman', 'Breathe in your fears. Face them. To conquer fear, you must become fear.')
            let result = await wallet.get('Batman')
            return expect(result).to.equal('Breathe in your fears. Face them. To conquer fear, you must become fear.')
          })

          it('should put twice with second overwriting', async () => {
            await wallet.put('Batman', 'Breathe in your fears. Face them. To conquer fear, you must become fear.')
            await wallet.put('Batman', 'It\'s not who I am underneath, but what I do that defines me')
            let result = await wallet.get('Batman')
            return expect(result).to.equal('It\'s not who I am underneath, but what I do that defines me')
          })

          it('should put a Buffer and get it back', async () => {
            // Creates a Buffer containing [0x1, 0x2, 0x3].
            const buffer = Buffer.from([1, 2, 3])
            await wallet.put('Batman', buffer)
            let result = await wallet.get('Batman')
            return expect(result).to.deep.equal(buffer)
          })

          it('should put a Buffer and get it back', async () => {
            // Creates a Buffer containing [0x1, 0x2, 0x3].
            const buffer = Buffer.from([1, 2, 3])
            const buffer2 = Buffer.from([4, 5, 6])
            await wallet.put('Batman', buffer)
            await wallet.put('Batman', buffer2)
            let result = await wallet.get('Batman')
            return expect(result).to.deep.equal(buffer2)
          })

          it('should reject other types', async () => {
            let Umbrella = class Umbrella {}
            return wallet.put('ThePenguin', new Umbrella()).should.be.rejectedWith('Unkown type being stored')
          })
        })
      })

      describe('Two Concurrent Wallets Path', async () => {
        let sandbox
        let walletAlpha
        let walletBeta
        beforeEach(async () => {
          await CLOUD_CONFIG.clean(cfg)
          sandbox = sinon.sandbox.create()
          let configAlpha = _.cloneDeep(cfg)
          configAlpha.collectionName = 'alpha'
          let configBeta = _.cloneDeep(cfg)
          configBeta.collectionName = 'beta'

          walletAlpha = CLOUD_CONFIG.getStore(configAlpha)
          walletBeta = CLOUD_CONFIG.getStore(configBeta)
        })

        afterEach(() => {
          sandbox.restore()
          walletAlpha = null
          walletBeta = null
        })

        it('should be able to put the same key in both without cross-contamination', async () => {
          await walletAlpha.put('Batman', 'Breathe in your fears. Face them. To conquer fear, you must become fear.')
          await walletBeta.put('Batman', 'It\'s not who I am underneath, but what I do that defines me')
          let resultA = await walletAlpha.get('Batman')
          expect(resultA).to.equal('Breathe in your fears. Face them. To conquer fear, you must become fear.')
          let resultB = await walletBeta.get('Batman')
          return expect(resultB).to.equal('It\'s not who I am underneath, but what I do that defines me')
        })
      })

      describe('Clean database', async () => {
        it('Clean', async () => {
          await CLOUD_CONFIG.clean(cfg)
        })
      })

    })
  })
})