import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { TalentFactory, TalentToken, Supporter, SupporterTalentToken } from "../generated/schema"
import * as TalentTokenTemplates from "../generated/templates/TalentToken/TalentToken"
import * as Templates from "../generated/templates"
import { TalentCreated } from "../generated/TalentFactory/TalentFactory"
import { Transfer } from "../generated/templates/TalentToken/TalentToken"
import { Stake, Unstake, RewardClaim } from "../generated/Staking/Staking"

const FACTORY_ADDRESS = '0xcF2b5dd4367B083d495Cfc4332b0970464ee1472'
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
const ZERO_BI = BigInt.fromI32(0)
const ONE_BI = BigInt.fromI32(1)
const FIVE_BI = BigInt.fromI32(5)
const INITIAL_SUPPLY_BI = BigInt.fromString("10000000000000000000000")
const ZERO_BD = BigDecimal.fromString('0')

export function handleTalentTokenCreated(event: TalentCreated): void {
  let factory = TalentFactory.load(FACTORY_ADDRESS)
  // load factory
  if (factory === null) {
    factory = new TalentFactory(FACTORY_ADDRESS)
    factory.talentCount = ZERO_BI
    factory.owner = ADDRESS_ZERO
  }

  factory.talentCount = factory.talentCount.plus(ONE_BI)
  factory.save()

  let talentToken = new TalentToken(event.params.token.toHex())
  talentToken.owner = event.params.talent.toHex()
  talentToken.supporterCounter = ZERO_BI
  talentToken.txCount = ZERO_BI
  talentToken.totalValueLocked = INITIAL_SUPPLY_BI
  talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI);

  Templates.TalentToken.create(event.params.token)

  talentToken.save()
  factory.save()
}

export function handleTransfer(event: Transfer): void {
  let contract = TalentTokenTemplates.TalentToken.bind(event.address)

  let talentToken = TalentToken.load(event.address.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.address.toHex())
  }

  talentToken.symbol = contract.symbol()
  talentToken.decimals = BigInt.fromI32(contract.decimals())
  talentToken.name = contract.name()
  talentToken.maxSupply = contract.MAX_SUPPLY()
  talentToken.totalSupply = contract.totalSupply()
  talentToken.txCount = talentToken.txCount.plus(ONE_BI);

  talentToken.save()
}

export function handleStake(event: Stake): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.supporterCounter = ZERO_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
    talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI)
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.talAmount)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.talAmount.div(FIVE_BI))

  let supporter = Supporter.load(event.params.owner.toHex())
  if(supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
    talentToken.supporterCounter = talentToken.supporterCounter.plus(ONE_BI)
  }

  supporter.totalAmount = supporter.totalAmount.plus(BigDecimal.fromString(event.params.talAmount.toString()))

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let supporterTalentRelationship = SupporterTalentToken.load(relationshipID)
  if (supporterTalentRelationship === null) {
    supporterTalentRelationship = new SupporterTalentToken(relationshipID)
    supporterTalentRelationship.supporter = supporter.id
    supporterTalentRelationship.talent = talentToken.id
    supporterTalentRelationship.amount = ZERO_BD
  }
  supporterTalentRelationship.talAmount = supporterTalentRelationship.amount.plus(BigDecimal.fromString(event.params.talAmount.toString()))
  supporterTalentRelationship.amount = supporterTalentRelationship.amount.plus(BigDecimal.fromString(event.params.talAmount.div(FIVE_BI).toString()))

  talentToken.save()
  supporter.save()
  supporterTalentRelationship.save()
}

export function handleUnstake(event: Unstake): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.supporterCounter = ZERO_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
    talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI)
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.minus(event.params.talAmount)

  let supporter = Supporter.load(event.params.owner.toHex())
  if(supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
  }

  supporter.totalAmount = supporter.totalAmount.minus(BigDecimal.fromString(event.params.talAmount.toString()))

  if (supporter.totalAmount <= ZERO_BD) {
    talentToken.supporterCounter = talentToken.supporterCounter.minus(ONE_BI)
  }

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let supporterTalentRelationship = SupporterTalentToken.load(relationshipID)
  if (supporterTalentRelationship === null) {
    supporterTalentRelationship = new SupporterTalentToken(relationshipID)
    supporterTalentRelationship.supporter = supporter.id
    supporterTalentRelationship.talent = talentToken.id
    supporterTalentRelationship.amount = ZERO_BD
  }
  supporterTalentRelationship.amount = supporterTalentRelationship.amount.minus(BigDecimal.fromString(event.params.talAmount.toString()))

  talentToken.save()
  supporter.save()
  supporterTalentRelationship.save()
}

export function handleRewardClaim(event: RewardClaim): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.supporterCounter = ONE_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.stakerReward)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.stakerReward.div(FIVE_BI))

  let supporter = Supporter.load(event.params.owner.toHex())
  if(supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
  }

  supporter.totalAmount = supporter.totalAmount.plus(BigDecimal.fromString(event.params.stakerReward.toString()))

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let supporterTalentRelationship = SupporterTalentToken.load(relationshipID)
  if (supporterTalentRelationship === null) {
    supporterTalentRelationship = new SupporterTalentToken(relationshipID)
    supporterTalentRelationship.supporter = supporter.id
    supporterTalentRelationship.talent = talentToken.id
    supporterTalentRelationship.amount = ZERO_BD
  }
  supporterTalentRelationship.talAmount = supporterTalentRelationship.amount.plus(BigDecimal.fromString(event.params.stakerReward.toString()))
  supporterTalentRelationship.amount = supporterTalentRelationship.amount.plus(BigDecimal.fromString(event.params.stakerReward.div(FIVE_BI).toString()))

  talentToken.save()
  supporter.save()
  supporterTalentRelationship.save()
}