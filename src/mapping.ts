import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"
import { TalentFactory, Supporter, TalentToken, SupporterTalentToken, TalentTokenDayData } from "../generated/schema"
import * as TalentTokenTemplates from "../generated/templates/TalentToken/TalentTokenV3"
import * as Templates from "../generated/templates"
import { TalentCreated } from "../generated/TalentFactory/TalentFactoryV3"
import { Transfer } from "../generated/templates/TalentToken/TalentTokenV3"
import { Stake, Unstake } from "../generated/Staking/StakingV3"

const FACTORY_ADDRESS = '0x33f8FB8C3cA4465Ca02899145b4489b8eDf3A2FD'
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
const ZERO_BI = BigInt.fromI32(0)
const ONE_BI = BigInt.fromI32(1)
const FIVE_BI = BigInt.fromI32(5)
const INITIAL_SUPPLY_BI = BigInt.fromString("10000000000000000000000")
const ZERO_BD = BigDecimal.fromString('0')

export function handleTalentTokenCreated(event: TalentCreated): void {
  const token = event.params.token
  const owner = event.params.talent.toHex()
  const timestamp = event.block.timestamp

  initializeFactoryAndTalentToken(token, owner, timestamp)
}

export function handleTransfer(event: Transfer): void {
  let contract = TalentTokenTemplates.TalentTokenV3.bind(event.address)

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

  updateTalentDayData(event)
}

export function handleStake(event: Stake): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    const token = event.params.talentToken
    let contract = TalentTokenTemplates.TalentTokenV3.bind(token)
    const owner = contract.talent().toHex()
    const timestamp = event.block.timestamp

    talentToken = initializeFactoryAndTalentToken(token, owner, timestamp)

    talentToken.supporterCounter = ZERO_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
    talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI)
    talentToken.rewardsReady = ZERO_BD
    talentToken.rewardsClaimed = ZERO_BD
    talentToken.symbol = contract.symbol()
    talentToken.decimals = BigInt.fromI32(contract.decimals())
    talentToken.name = contract.name()
    talentToken.maxSupply = contract.MAX_SUPPLY()
    talentToken.totalSupply = contract.totalSupply()
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.talAmount)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.talAmount.div(FIVE_BI))

  let supporter = Supporter.load(event.params.owner.toHex())
  if(supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
  }

  supporter.totalAmount = supporter.totalAmount.plus(BigDecimal.fromString(event.params.talAmount.toString()))

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let supporterTalentRelationship = SupporterTalentToken.load(relationshipID)
  if (supporterTalentRelationship === null) {
    supporterTalentRelationship = new SupporterTalentToken(relationshipID)
    supporterTalentRelationship.supporter = supporter.id
    supporterTalentRelationship.talent = talentToken.id
    supporterTalentRelationship.amount = ZERO_BD
    supporterTalentRelationship.talAmount = ZERO_BD
    supporterTalentRelationship.firstTimeBoughtAt = event.block.timestamp
    talentToken.supporterCounter = talentToken.supporterCounter.plus(ONE_BI)
  }

  supporterTalentRelationship.lastTimeBoughtAt = event.block.timestamp
  supporterTalentRelationship.talAmount = supporterTalentRelationship.talAmount.plus(BigDecimal.fromString(event.params.talAmount.toString()))
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
    talentToken.rewardsReady = ZERO_BD
    talentToken.rewardsClaimed = ZERO_BD
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.minus(event.params.talAmount)

  let supporter = Supporter.load(event.params.owner.toHex())
  if(supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
    supporter.rewardsClaimed = ZERO_BD
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
    supporterTalentRelationship.talAmount = ZERO_BD
  }

  supporterTalentRelationship.talAmount = supporterTalentRelationship.talAmount.minus(BigDecimal.fromString(event.params.talAmount.toString()))
  supporterTalentRelationship.amount = supporterTalentRelationship.amount.minus(BigDecimal.fromString(event.params.talAmount.div(FIVE_BI).toString()))

  talentToken.save()
  supporter.save()
  supporterTalentRelationship.save()
}

function updateTalentDayData(event: Transfer): void {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;

  const talentTokenAddress = event.address.toHex();
  let talentToken = TalentToken.load(talentTokenAddress);
  if (talentToken === null) {
    talentToken = new TalentToken(talentTokenAddress);
  }

  const tokenDayDataId = talentTokenAddress
    .concat("-")
    .concat(BigInt.fromI32(dayID).toString());
  let talentDayData = TalentTokenDayData.load(tokenDayDataId);
  if (talentDayData === null) {
    talentDayData = new TalentTokenDayData(tokenDayDataId);
    talentDayData.date = dayStartTimestamp;
    talentDayData.dailySupply = ZERO_BI;
    talentDayData.talent = talentToken.id;
  }
  talentDayData.dailySupply = talentToken.totalSupply;
  talentDayData.save();
}

function initializeFactoryAndTalentToken(token: Address, owner: string, timestamp: BigInt): TalentToken {
  let factory = TalentFactory.load(FACTORY_ADDRESS)
  // load factory
  if (factory === null) {
    factory = new TalentFactory(FACTORY_ADDRESS)
    factory.talentCount = ZERO_BI
    factory.owner = ADDRESS_ZERO
  }

  factory.talentCount = factory.talentCount.plus(ONE_BI)
  factory.save()

  let talentToken = new TalentToken(token.toHex())

  talentToken.supporterCounter = ZERO_BI
  talentToken.txCount = ZERO_BI
  talentToken.totalValueLocked = INITIAL_SUPPLY_BI
  talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI)
  talentToken.rewardsReady = ZERO_BD
  talentToken.rewardsClaimed = ZERO_BD
  talentToken.createdAtTimestamp = timestamp
  talentToken.owner = owner

  Templates.TalentToken.create(token)

  talentToken.save()
  factory.save()

  return talentToken
}
