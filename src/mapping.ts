import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { TalentFactory, TalentToken, Supporter, SupporterTalentToken, TalentTokenDayData } from "../generated/schema"
import * as TalentTokenTemplates from "../generated/templates/TalentToken/TalentToken"
import * as Templates from "../generated/templates"
import { TalentCreated } from "../generated/TalentFactory/TalentFactory"
import { Transfer } from "../generated/templates/TalentToken/TalentToken"
import { Stake, Unstake, RewardClaim, StakeTransferred } from "../generated/Staking/Staking"

const FACTORY_ADDRESS = '0xa902DA7a40a671B84bA3Dd0BdBA6FD9d2D888246'
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
  talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI)
  talentToken.rewardsReady = ZERO_BD
  talentToken.rewardsClaimed = ZERO_BD
  talentToken.createdAtTimestamp = event.block.timestamp;

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

  updateTalentDayData(event)
}

export function handleStake(event: Stake): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.supporterCounter = ZERO_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
    talentToken.marketCap = INITIAL_SUPPLY_BI.div(FIVE_BI)
    talentToken.rewardsReady = ZERO_BD
    talentToken.rewardsClaimed = ZERO_BD
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

export function handleRewardClaim(event: RewardClaim): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.supporterCounter = ONE_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
    talentToken.rewardsReady = ZERO_BD
    talentToken.rewardsClaimed = ZERO_BD
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.stakerReward)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.stakerReward.div(FIVE_BI))

  let supporter = Supporter.load(event.params.owner.toHex())
  if(supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
    supporter.rewardsClaimed = ZERO_BD
  }

  supporter.totalAmount = supporter.totalAmount.plus(BigDecimal.fromString(event.params.stakerReward.toString()))
  supporter.rewardsClaimed = supporter.rewardsClaimed.plus(BigDecimal.fromString(event.params.stakerReward.toString()))

  talentToken.rewardsReady = talentToken.rewardsReady.plus(BigDecimal.fromString(event.params.talentReward.toString()))

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let supporterTalentRelationship = SupporterTalentToken.load(relationshipID)
  if (supporterTalentRelationship === null) {
    supporterTalentRelationship = new SupporterTalentToken(relationshipID)
    supporterTalentRelationship.supporter = supporter.id
    supporterTalentRelationship.talent = talentToken.id
    supporterTalentRelationship.amount = ZERO_BD
    talentToken.supporterCounter = talentToken.supporterCounter.plus(ONE_BI)
  }
  supporterTalentRelationship.talAmount = supporterTalentRelationship.talAmount.plus(BigDecimal.fromString(event.params.stakerReward.toString()))
  supporterTalentRelationship.amount = supporterTalentRelationship.amount.plus(BigDecimal.fromString(event.params.stakerReward.div(FIVE_BI).toString()))
  supporterTalentRelationship.lastTimeBoughtAt = event.block.timestamp

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

export function handleStakeOwnershipChange(event: StakeTransferred): void {
  let talentToken = TalentToken.load(event.params.talent.toHex())
  let supporter = Supporter.load(event.params.owner.toHex());
  let newSupporter = Supporter.load(event.params.newOwner.toHex());

  if (newSupporter == null) {
    newSupporter = new Supporter(event.params.newOwner.toHex())
    newSupporter.totalAmount = ZERO_BD
    newSupporter.rewardsClaimed = ZERO_BD
  }

  if (talentToken === null) {
    talentToken = new TalentToken(event.params.talent.toHex())
    talentToken.supporterCounter = ONE_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
    talentToken.rewardsReady = ZERO_BD
    talentToken.rewardsClaimed = ZERO_BD
  }

  if (supporter === null) {
    supporter = new Supporter(event.params.owner.toHex())
    supporter.totalAmount = ZERO_BD
    supporter.rewardsClaimed = ZERO_BD
  }

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talent.toHexString();
  let ownerTalentRelationship = SupporterTalentToken.load(relationshipID)

  if (ownerTalentRelationship === null) {
    ownerTalentRelationship = new SupporterTalentToken(relationshipID)
    ownerTalentRelationship.supporter = supporter.id
    ownerTalentRelationship.talent = talentToken.id
    ownerTalentRelationship.amount = ZERO_BD
  }

  let newRelationshipID = event.params.newOwner.toHexString() + "-" + event.params.talent.toHexString();
  let newOwnerTalentRelationship = SupporterTalentToken.load(newRelationshipID)

  if (newOwnerTalentRelationship == null) {
    newOwnerTalentRelationship = new SupporterTalentToken(newRelationshipID)
    newOwnerTalentRelationship.supporter = newSupporter.id
    newOwnerTalentRelationship.talent = talentToken.id
    newOwnerTalentRelationship.amount = ownerTalentRelationship.amount
    newOwnerTalentRelationship.talAmount = ownerTalentRelationship.talAmount
    newOwnerTalentRelationship.firstTimeBoughtAt = ownerTalentRelationship.firstTimeBoughtAt
    newOwnerTalentRelationship.lastTimeBoughtAt = ownerTalentRelationship.lastTimeBoughtAt
  } else {
    newOwnerTalentRelationship.amount = newOwnerTalentRelationship.amount.plus(ownerTalentRelationship.amount)
    newOwnerTalentRelationship.talAmount = newOwnerTalentRelationship.talAmount.plus(ownerTalentRelationship.talAmount)
    talentToken.supporterCounter = talentToken.supporterCounter.minus(ONE_BI)
  }

  newSupporter.totalAmount = newSupporter.totalAmount.plus(ownerTalentRelationship.talAmount)
  supporter.totalAmount = supporter.totalAmount.minus(ownerTalentRelationship.talAmount)

  newSupporter.save()
  newOwnerTalentRelationship.save()
  talentToken.save()
  supporter.save()
  ownerTalentRelationship.unset(relationshipID)
}
