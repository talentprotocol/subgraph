import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { TalentFactory, TalentToken, Sponsor, SponsorTalentToken } from "../generated/schema"
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
const EXP_18 = BigDecimal.fromString('1000000000000000000')
const ZERO_BD = BigDecimal.fromString('0')
const ONE_BD = BigDecimal.fromString('1')

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
  talentToken.sponsorCounter = ZERO_BI
  talentToken.txCount = ZERO_BI
  talentToken.totalValueLocked = INITIAL_SUPPLY_BI

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
    talentToken.sponsorCounter = ZERO_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
  }

  talentToken.sponsorCounter = talentToken.sponsorCounter.plus(ONE_BI)
  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.talAmount)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.talAmount.div(FIVE_BI))

  let sponsor = Sponsor.load(event.params.owner.toHex())
  if(sponsor === null) {
    sponsor = new Sponsor(event.params.owner.toHex())
    sponsor.totalAmount = ZERO_BD
  }

  sponsor.totalAmount = sponsor.totalAmount.plus(BigDecimal.fromString(event.params.talAmount.toString()))

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let sponsorTalentRelationship = SponsorTalentToken.load(relationshipID)
  if (sponsorTalentRelationship === null) {
    sponsorTalentRelationship = new SponsorTalentToken(relationshipID)
    sponsorTalentRelationship.sponsor = sponsor.id
    sponsorTalentRelationship.talent = talentToken.id
    sponsorTalentRelationship.amount = ZERO_BD
  }
  sponsorTalentRelationship.talAmount = sponsorTalentRelationship.amount.plus(BigDecimal.fromString(event.params.talAmount.toString()))
  sponsorTalentRelationship.amount = sponsorTalentRelationship.amount.plus(BigDecimal.fromString(event.params.talAmount.div(FIVE_BI).toString()))

  talentToken.save()
  sponsor.save()
  sponsorTalentRelationship.save()
}

export function handleUnstake(event: Unstake): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.sponsorCounter = ZERO_BI
    talentToken.totalValueLocked = ZERO_BI
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.minus(event.params.talAmount)

  let sponsor = Sponsor.load(event.params.owner.toHex())
  if(sponsor === null) {
    sponsor = new Sponsor(event.params.owner.toHex())
    sponsor.totalAmount = ZERO_BD
  }

  sponsor.totalAmount = sponsor.totalAmount.minus(BigDecimal.fromString(event.params.talAmount.toString()))

  if (sponsor.totalAmount <= ZERO_BD) {
    talentToken.sponsorCounter = talentToken.sponsorCounter.minus(ONE_BI)
  }

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let sponsorTalentRelationship = SponsorTalentToken.load(relationshipID)
  if (sponsorTalentRelationship === null) {
    sponsorTalentRelationship = new SponsorTalentToken(relationshipID)
    sponsorTalentRelationship.sponsor = sponsor.id
    sponsorTalentRelationship.talent = talentToken.id
    sponsorTalentRelationship.amount = ZERO_BD
  }
  sponsorTalentRelationship.amount = sponsorTalentRelationship.amount.minus(BigDecimal.fromString(event.params.talAmount.toString()))

  talentToken.save()
  sponsor.save()
  sponsorTalentRelationship.save()
}

export function handleRewardClaim(event: RewardClaim): void {
  let talentToken = TalentToken.load(event.params.talentToken.toHex())
  if(talentToken === null) {
    talentToken = new TalentToken(event.params.talentToken.toHex())
    talentToken.sponsorCounter = ONE_BI
    talentToken.totalValueLocked = INITIAL_SUPPLY_BI
  }

  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.stakerReward)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.stakerReward.div(FIVE_BI))

  let sponsor = Sponsor.load(event.params.owner.toHex())
  if(sponsor === null) {
    sponsor = new Sponsor(event.params.owner.toHex())
    sponsor.totalAmount = ZERO_BD
  }

  sponsor.totalAmount = sponsor.totalAmount.plus(BigDecimal.fromString(event.params.stakerReward.toString()))

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let sponsorTalentRelationship = SponsorTalentToken.load(relationshipID)
  if (sponsorTalentRelationship === null) {
    sponsorTalentRelationship = new SponsorTalentToken(relationshipID)
    sponsorTalentRelationship.sponsor = sponsor.id
    sponsorTalentRelationship.talent = talentToken.id
    sponsorTalentRelationship.amount = ZERO_BD
  }
  sponsorTalentRelationship.talAmount = sponsorTalentRelationship.amount.plus(BigDecimal.fromString(event.params.stakerReward.toString()))
  sponsorTalentRelationship.amount = sponsorTalentRelationship.amount.plus(BigDecimal.fromString(event.params.stakerReward.div(FIVE_BI).toString()))

  talentToken.save()
  sponsor.save()
  sponsorTalentRelationship.save()
}