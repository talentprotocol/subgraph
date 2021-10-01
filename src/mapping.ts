import { BigInt } from "@graphprotocol/graph-ts"
import { TalentFactory, TalentToken, Sponsor, SponsorTalentToken } from "../generated/schema"
import * as TalentTokenTemplates from "../generated/templates/TalentToken/TalentToken"
import * as Templates from "../generated/templates"
import { TalentCreated } from "../generated/TalentFactory/TalentFactory"
import { Transfer } from "../generated/templates/TalentToken/TalentToken"
import { Stake, Unstake } from "../generated/Staking/Staking"

const FACTORY_ADDRESS = '0xcF2b5dd4367B083d495Cfc4332b0970464ee1472'
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
const ZERO_BI = BigInt.fromI32(0)
const ONE_BI = BigInt.fromI32(1)
const FIVE_BI = BigInt.fromI32(5)

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
  talentToken.totalValueLocked = ZERO_BI

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
    talentToken.totalValueLocked = ZERO_BI
  }

  talentToken.sponsorCounter = talentToken.sponsorCounter.plus(ONE_BI)
  talentToken.totalValueLocked = talentToken.totalValueLocked.plus(event.params.talAmount)
  talentToken.marketCap = talentToken.marketCap.plus(event.params.talAmount.div(FIVE_BI))

  let sponsor = Sponsor.load(event.params.owner.toHex())
  if(sponsor === null) {
    sponsor = new Sponsor(event.params.owner.toHex())
    sponsor.totalAmount = ZERO_BI
  }

  sponsor.totalAmount = sponsor.totalAmount.plus(event.params.talAmount)

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let sponsorTalentRelationship = SponsorTalentToken.load(relationshipID)
  if (sponsorTalentRelationship === null) {
    sponsorTalentRelationship = new SponsorTalentToken(relationshipID)
    sponsorTalentRelationship.sponsor = sponsor.id
    sponsorTalentRelationship.talent = talentToken.id
    sponsorTalentRelationship.amount = ZERO_BI
  }
  sponsorTalentRelationship.talAmount = sponsorTalentRelationship.amount.plus(event.params.talAmount)
  sponsorTalentRelationship.amount = sponsorTalentRelationship.amount.plus(event.params.talAmount.div(FIVE_BI))

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
    sponsor.totalAmount = ZERO_BI
  }

  sponsor.totalAmount = sponsor.totalAmount.minus(event.params.talAmount)

  if (sponsor.totalAmount <= ZERO_BI) {
    talentToken.sponsorCounter = talentToken.sponsorCounter.minus(ONE_BI)
  }

  let relationshipID = event.params.owner.toHexString() + "-" + event.params.talentToken.toHexString()
  let sponsorTalentRelationship = SponsorTalentToken.load(relationshipID)
  if (sponsorTalentRelationship === null) {
    sponsorTalentRelationship = new SponsorTalentToken(relationshipID)
    sponsorTalentRelationship.sponsor = sponsor.id
    sponsorTalentRelationship.talent = talentToken.id
    sponsorTalentRelationship.amount = ZERO_BI
  }
  sponsorTalentRelationship.amount = sponsorTalentRelationship.amount.minus(event.params.talAmount)

  talentToken.save()
  sponsor.save()
  sponsorTalentRelationship.save()
}