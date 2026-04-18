// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; https://www.gnu.org/licenses/agpl.html

import type { PlainMessage } from "@bufbuild/protobuf";
import type { PostProtoOptions } from "./post";
import { postProto } from "./post";
import * as ankihub from "./anki/ankihub_pb";
import * as ankiweb from "./anki/ankiweb_pb";
import * as cardRendering from "./anki/card_rendering_pb";
import * as cards from "./anki/cards_pb";
import * as collection from "./anki/collection_pb";
import * as config from "./anki/config_pb";
import * as deckConfig from "./anki/deck_config_pb";
import * as decks from "./anki/decks_pb";
import * as frontend from "./anki/frontend_pb";
import * as generic from "./anki/generic_pb";
import * as i18n from "./anki/i18n_pb";
import * as imageOcclusion from "./anki/image_occlusion_pb";
import * as importExport from "./anki/import_export_pb";
import * as links from "./anki/links_pb";
import * as media from "./anki/media_pb";
import * as notes from "./anki/notes_pb";
import * as notetypes from "./anki/notetypes_pb";
import * as scheduler from "./anki/scheduler_pb";
import * as search from "./anki/search_pb";
import * as stats from "./anki/stats_pb";
import * as sync from "./anki/sync_pb";
import * as tags from "./anki/tags_pb";
export async function syncMedia(input: PlainMessage<sync.SyncAuth>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("syncMedia", new sync.SyncAuth(input), generic.Empty, options);
}
export async function abortMediaSync(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("abortMediaSync", new generic.Empty(input), generic.Empty, options);
}
/** Can be used by the frontend to detect an active sync. If the sync aborted
 with an error, the next call to this method will return the error. */
export async function mediaSyncStatus(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<sync.MediaSyncStatusResponse> {
        return await postProto("mediaSyncStatus", new generic.Empty(input), sync.MediaSyncStatusResponse, options);
}
export async function syncLogin(input: PlainMessage<sync.SyncLoginRequest>, options?: PostProtoOptions): Promise<sync.SyncAuth> {
        return await postProto("syncLogin", new sync.SyncLoginRequest(input), sync.SyncAuth, options);
}
export async function syncStatus(input: PlainMessage<sync.SyncAuth>, options?: PostProtoOptions): Promise<sync.SyncStatusResponse> {
        return await postProto("syncStatus", new sync.SyncAuth(input), sync.SyncStatusResponse, options);
}
export async function syncCollection(input: PlainMessage<sync.SyncCollectionRequest>, options?: PostProtoOptions): Promise<sync.SyncCollectionResponse> {
        return await postProto("syncCollection", new sync.SyncCollectionRequest(input), sync.SyncCollectionResponse, options);
}
export async function fullUploadOrDownload(input: PlainMessage<sync.FullUploadOrDownloadRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("fullUploadOrDownload", new sync.FullUploadOrDownloadRequest(input), generic.Empty, options);
}
export async function abortSync(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("abortSync", new generic.Empty(input), generic.Empty, options);
}
export async function setCustomCertificate(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<generic.Bool> {
        return await postProto("setCustomCertificate", new generic.String(input), generic.Bool, options);
}
export async function openCollection(input: PlainMessage<collection.OpenCollectionRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("openCollection", new collection.OpenCollectionRequest(input), generic.Empty, options);
}
export async function closeCollection(input: PlainMessage<collection.CloseCollectionRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("closeCollection", new collection.CloseCollectionRequest(input), generic.Empty, options);
}
/** Create a no-media backup. Caller must ensure there is no active
 transaction. Unlike a collection export, does not require reopening the DB,
 as there is no downgrade step.
 Returns false if it's not time to make a backup yet. */
export async function createBackup(input: PlainMessage<collection.CreateBackupRequest>, options?: PostProtoOptions): Promise<generic.Bool> {
        return await postProto("createBackup", new collection.CreateBackupRequest(input), generic.Bool, options);
}
/** If a backup is running, wait for it to complete. Will return an error
 if the backup encountered an error. */
export async function awaitBackupCompletion(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("awaitBackupCompletion", new generic.Empty(input), generic.Empty, options);
}
export async function latestProgress(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.Progress> {
        return await postProto("latestProgress", new generic.Empty(input), collection.Progress, options);
}
export async function setWantsAbort(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("setWantsAbort", new generic.Empty(input), generic.Empty, options);
}
export async function checkDatabase(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.CheckDatabaseResponse> {
        return await postProto("checkDatabase", new generic.Empty(input), collection.CheckDatabaseResponse, options);
}
export async function getUndoStatus(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.UndoStatus> {
        return await postProto("getUndoStatus", new generic.Empty(input), collection.UndoStatus, options);
}
export async function undo(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.OpChangesAfterUndo> {
        return await postProto("undo", new generic.Empty(input), collection.OpChangesAfterUndo, options);
}
export async function redo(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.OpChangesAfterUndo> {
        return await postProto("redo", new generic.Empty(input), collection.OpChangesAfterUndo, options);
}
export async function addCustomUndoEntry(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<generic.UInt32> {
        return await postProto("addCustomUndoEntry", new generic.String(input), generic.UInt32, options);
}
export async function mergeUndoEntries(input: PlainMessage<generic.UInt32>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("mergeUndoEntries", new generic.UInt32(input), collection.OpChanges, options);
}
export async function setLoadBalancerEnabled(input: PlainMessage<generic.Bool>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setLoadBalancerEnabled", new generic.Bool(input), collection.OpChanges, options);
}
export async function getCard(input: PlainMessage<cards.CardId>, options?: PostProtoOptions): Promise<cards.Card> {
        return await postProto("getCard", new cards.CardId(input), cards.Card, options);
}
export async function updateCards(input: PlainMessage<cards.UpdateCardsRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateCards", new cards.UpdateCardsRequest(input), collection.OpChanges, options);
}
export async function removeCards(input: PlainMessage<cards.RemoveCardsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("removeCards", new cards.RemoveCardsRequest(input), collection.OpChangesWithCount, options);
}
export async function setDeck(input: PlainMessage<cards.SetDeckRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("setDeck", new cards.SetDeckRequest(input), collection.OpChangesWithCount, options);
}
export async function setFlag(input: PlainMessage<cards.SetFlagRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("setFlag", new cards.SetFlagRequest(input), collection.OpChangesWithCount, options);
}
export async function newDeck(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<decks.Deck> {
        return await postProto("newDeck", new generic.Empty(input), decks.Deck, options);
}
export async function addDeck(input: PlainMessage<decks.Deck>, options?: PostProtoOptions): Promise<collection.OpChangesWithId> {
        return await postProto("addDeck", new decks.Deck(input), collection.OpChangesWithId, options);
}
export async function addDeckLegacy(input: PlainMessage<generic.Json>, options?: PostProtoOptions): Promise<collection.OpChangesWithId> {
        return await postProto("addDeckLegacy", new generic.Json(input), collection.OpChangesWithId, options);
}
export async function addOrUpdateDeckLegacy(input: PlainMessage<decks.AddOrUpdateDeckLegacyRequest>, options?: PostProtoOptions): Promise<decks.DeckId> {
        return await postProto("addOrUpdateDeckLegacy", new decks.AddOrUpdateDeckLegacyRequest(input), decks.DeckId, options);
}
export async function deckTree(input: PlainMessage<decks.DeckTreeRequest>, options?: PostProtoOptions): Promise<decks.DeckTreeNode> {
        return await postProto("deckTree", new decks.DeckTreeRequest(input), decks.DeckTreeNode, options);
}
export async function deckTreeLegacy(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("deckTreeLegacy", new generic.Empty(input), generic.Json, options);
}
export async function getAllDecksLegacy(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getAllDecksLegacy", new generic.Empty(input), generic.Json, options);
}
export async function getDeckIdByName(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<decks.DeckId> {
        return await postProto("getDeckIdByName", new generic.String(input), decks.DeckId, options);
}
export async function getDeck(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<decks.Deck> {
        return await postProto("getDeck", new decks.DeckId(input), decks.Deck, options);
}
export async function updateDeck(input: PlainMessage<decks.Deck>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateDeck", new decks.Deck(input), collection.OpChanges, options);
}
export async function updateDeckLegacy(input: PlainMessage<generic.Json>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateDeckLegacy", new generic.Json(input), collection.OpChanges, options);
}
export async function setDeckCollapsed(input: PlainMessage<decks.SetDeckCollapsedRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setDeckCollapsed", new decks.SetDeckCollapsedRequest(input), collection.OpChanges, options);
}
export async function getDeckLegacy(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getDeckLegacy", new decks.DeckId(input), generic.Json, options);
}
export async function getDeckNames(input: PlainMessage<decks.GetDeckNamesRequest>, options?: PostProtoOptions): Promise<decks.DeckNames> {
        return await postProto("getDeckNames", new decks.GetDeckNamesRequest(input), decks.DeckNames, options);
}
export async function getDeckAndChildNames(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<decks.DeckNames> {
        return await postProto("getDeckAndChildNames", new decks.DeckId(input), decks.DeckNames, options);
}
export async function newDeckLegacy(input: PlainMessage<generic.Bool>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("newDeckLegacy", new generic.Bool(input), generic.Json, options);
}
export async function removeDecks(input: PlainMessage<decks.DeckIds>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("removeDecks", new decks.DeckIds(input), collection.OpChangesWithCount, options);
}
export async function reparentDecks(input: PlainMessage<decks.ReparentDecksRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("reparentDecks", new decks.ReparentDecksRequest(input), collection.OpChangesWithCount, options);
}
export async function renameDeck(input: PlainMessage<decks.RenameDeckRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("renameDeck", new decks.RenameDeckRequest(input), collection.OpChanges, options);
}
export async function getOrCreateFilteredDeck(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<decks.FilteredDeckForUpdate> {
        return await postProto("getOrCreateFilteredDeck", new decks.DeckId(input), decks.FilteredDeckForUpdate, options);
}
export async function addOrUpdateFilteredDeck(input: PlainMessage<decks.FilteredDeckForUpdate>, options?: PostProtoOptions): Promise<collection.OpChangesWithId> {
        return await postProto("addOrUpdateFilteredDeck", new decks.FilteredDeckForUpdate(input), collection.OpChangesWithId, options);
}
export async function filteredDeckOrderLabels(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.StringList> {
        return await postProto("filteredDeckOrderLabels", new generic.Empty(input), generic.StringList, options);
}
export async function setCurrentDeck(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setCurrentDeck", new decks.DeckId(input), collection.OpChanges, options);
}
export async function getCurrentDeck(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<decks.Deck> {
        return await postProto("getCurrentDeck", new generic.Empty(input), decks.Deck, options);
}
export async function getConfigJson(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getConfigJson", new generic.String(input), generic.Json, options);
}
export async function setConfigJson(input: PlainMessage<config.SetConfigJsonRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setConfigJson", new config.SetConfigJsonRequest(input), collection.OpChanges, options);
}
export async function setConfigJsonNoUndo(input: PlainMessage<config.SetConfigJsonRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("setConfigJsonNoUndo", new config.SetConfigJsonRequest(input), generic.Empty, options);
}
export async function removeConfig(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("removeConfig", new generic.String(input), collection.OpChanges, options);
}
export async function getAllConfig(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getAllConfig", new generic.Empty(input), generic.Json, options);
}
export async function getConfigBool(input: PlainMessage<config.GetConfigBoolRequest>, options?: PostProtoOptions): Promise<generic.Bool> {
        return await postProto("getConfigBool", new config.GetConfigBoolRequest(input), generic.Bool, options);
}
export async function setConfigBool(input: PlainMessage<config.SetConfigBoolRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setConfigBool", new config.SetConfigBoolRequest(input), collection.OpChanges, options);
}
export async function getConfigString(input: PlainMessage<config.GetConfigStringRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("getConfigString", new config.GetConfigStringRequest(input), generic.String, options);
}
export async function setConfigString(input: PlainMessage<config.SetConfigStringRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setConfigString", new config.SetConfigStringRequest(input), collection.OpChanges, options);
}
export async function getPreferences(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<config.Preferences> {
        return await postProto("getPreferences", new generic.Empty(input), config.Preferences, options);
}
export async function setPreferences(input: PlainMessage<config.Preferences>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setPreferences", new config.Preferences(input), collection.OpChanges, options);
}
export async function addOrUpdateDeckConfigLegacy(input: PlainMessage<generic.Json>, options?: PostProtoOptions): Promise<deckConfig.DeckConfigId> {
        return await postProto("addOrUpdateDeckConfigLegacy", new generic.Json(input), deckConfig.DeckConfigId, options);
}
export async function getDeckConfig(input: PlainMessage<deckConfig.DeckConfigId>, options?: PostProtoOptions): Promise<deckConfig.DeckConfig> {
        return await postProto("getDeckConfig", new deckConfig.DeckConfigId(input), deckConfig.DeckConfig, options);
}
export async function allDeckConfigLegacy(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("allDeckConfigLegacy", new generic.Empty(input), generic.Json, options);
}
export async function getDeckConfigLegacy(input: PlainMessage<deckConfig.DeckConfigId>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getDeckConfigLegacy", new deckConfig.DeckConfigId(input), generic.Json, options);
}
export async function newDeckConfigLegacy(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("newDeckConfigLegacy", new generic.Empty(input), generic.Json, options);
}
export async function removeDeckConfig(input: PlainMessage<deckConfig.DeckConfigId>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("removeDeckConfig", new deckConfig.DeckConfigId(input), generic.Empty, options);
}
export async function getDeckConfigsForUpdate(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<deckConfig.DeckConfigsForUpdate> {
        return await postProto("getDeckConfigsForUpdate", new decks.DeckId(input), deckConfig.DeckConfigsForUpdate, options);
}
export async function updateDeckConfigs(input: PlainMessage<deckConfig.UpdateDeckConfigsRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateDeckConfigs", new deckConfig.UpdateDeckConfigsRequest(input), collection.OpChanges, options);
}
export async function getIgnoredBeforeCount(input: PlainMessage<deckConfig.GetIgnoredBeforeCountRequest>, options?: PostProtoOptions): Promise<deckConfig.GetIgnoredBeforeCountResponse> {
        return await postProto("getIgnoredBeforeCount", new deckConfig.GetIgnoredBeforeCountRequest(input), deckConfig.GetIgnoredBeforeCountResponse, options);
}
export async function getRetentionWorkload(input: PlainMessage<deckConfig.GetRetentionWorkloadRequest>, options?: PostProtoOptions): Promise<deckConfig.GetRetentionWorkloadResponse> {
        return await postProto("getRetentionWorkload", new deckConfig.GetRetentionWorkloadRequest(input), deckConfig.GetRetentionWorkloadResponse, options);
}
export async function computeFsrsParamsFromItems(input: PlainMessage<scheduler.ComputeFsrsParamsFromItemsRequest>, options?: PostProtoOptions): Promise<scheduler.ComputeFsrsParamsResponse> {
        return await postProto("computeFsrsParamsFromItems", new scheduler.ComputeFsrsParamsFromItemsRequest(input), scheduler.ComputeFsrsParamsResponse, options);
}
/** Generates parameters used for FSRS's scheduler benchmarks. */
export async function fsrsBenchmark(input: PlainMessage<scheduler.FsrsBenchmarkRequest>, options?: PostProtoOptions): Promise<scheduler.FsrsBenchmarkResponse> {
        return await postProto("fsrsBenchmark", new scheduler.FsrsBenchmarkRequest(input), scheduler.FsrsBenchmarkResponse, options);
}
/** Used for exporting revlogs for algorithm research. */
export async function exportDataset(input: PlainMessage<scheduler.ExportDatasetRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("exportDataset", new scheduler.ExportDatasetRequest(input), generic.Empty, options);
}
export async function getQueuedCards(input: PlainMessage<scheduler.GetQueuedCardsRequest>, options?: PostProtoOptions): Promise<scheduler.QueuedCards> {
        return await postProto("getQueuedCards", new scheduler.GetQueuedCardsRequest(input), scheduler.QueuedCards, options);
}
export async function answerCard(input: PlainMessage<scheduler.CardAnswer>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("answerCard", new scheduler.CardAnswer(input), collection.OpChanges, options);
}
export async function schedTimingToday(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<scheduler.SchedTimingTodayResponse> {
        return await postProto("schedTimingToday", new generic.Empty(input), scheduler.SchedTimingTodayResponse, options);
}
export async function studiedToday(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("studiedToday", new generic.Empty(input), generic.String, options);
}
export async function studiedTodayMessage(input: PlainMessage<scheduler.StudiedTodayMessageRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("studiedTodayMessage", new scheduler.StudiedTodayMessageRequest(input), generic.String, options);
}
export async function updateStats(input: PlainMessage<scheduler.UpdateStatsRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("updateStats", new scheduler.UpdateStatsRequest(input), generic.Empty, options);
}
export async function extendLimits(input: PlainMessage<scheduler.ExtendLimitsRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("extendLimits", new scheduler.ExtendLimitsRequest(input), generic.Empty, options);
}
export async function countsForDeckToday(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<scheduler.CountsForDeckTodayResponse> {
        return await postProto("countsForDeckToday", new decks.DeckId(input), scheduler.CountsForDeckTodayResponse, options);
}
export async function congratsInfo(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<scheduler.CongratsInfoResponse> {
        return await postProto("congratsInfo", new generic.Empty(input), scheduler.CongratsInfoResponse, options);
}
export async function restoreBuriedAndSuspendedCards(input: PlainMessage<cards.CardIds>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("restoreBuriedAndSuspendedCards", new cards.CardIds(input), collection.OpChanges, options);
}
export async function unburyDeck(input: PlainMessage<scheduler.UnburyDeckRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("unburyDeck", new scheduler.UnburyDeckRequest(input), collection.OpChanges, options);
}
export async function buryOrSuspendCards(input: PlainMessage<scheduler.BuryOrSuspendCardsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("buryOrSuspendCards", new scheduler.BuryOrSuspendCardsRequest(input), collection.OpChangesWithCount, options);
}
export async function emptyFilteredDeck(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("emptyFilteredDeck", new decks.DeckId(input), collection.OpChanges, options);
}
export async function rebuildFilteredDeck(input: PlainMessage<decks.DeckId>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("rebuildFilteredDeck", new decks.DeckId(input), collection.OpChangesWithCount, options);
}
export async function scheduleCardsAsNew(input: PlainMessage<scheduler.ScheduleCardsAsNewRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("scheduleCardsAsNew", new scheduler.ScheduleCardsAsNewRequest(input), collection.OpChanges, options);
}
export async function scheduleCardsAsNewDefaults(input: PlainMessage<scheduler.ScheduleCardsAsNewDefaultsRequest>, options?: PostProtoOptions): Promise<scheduler.ScheduleCardsAsNewDefaultsResponse> {
        return await postProto("scheduleCardsAsNewDefaults", new scheduler.ScheduleCardsAsNewDefaultsRequest(input), scheduler.ScheduleCardsAsNewDefaultsResponse, options);
}
export async function setDueDate(input: PlainMessage<scheduler.SetDueDateRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setDueDate", new scheduler.SetDueDateRequest(input), collection.OpChanges, options);
}
export async function gradeNow(input: PlainMessage<scheduler.GradeNowRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("gradeNow", new scheduler.GradeNowRequest(input), collection.OpChanges, options);
}
export async function sortCards(input: PlainMessage<scheduler.SortCardsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("sortCards", new scheduler.SortCardsRequest(input), collection.OpChangesWithCount, options);
}
export async function sortDeck(input: PlainMessage<scheduler.SortDeckRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("sortDeck", new scheduler.SortDeckRequest(input), collection.OpChangesWithCount, options);
}
export async function getSchedulingStates(input: PlainMessage<cards.CardId>, options?: PostProtoOptions): Promise<scheduler.SchedulingStates> {
        return await postProto("getSchedulingStates", new cards.CardId(input), scheduler.SchedulingStates, options);
}
export async function describeNextStates(input: PlainMessage<scheduler.SchedulingStates>, options?: PostProtoOptions): Promise<generic.StringList> {
        return await postProto("describeNextStates", new scheduler.SchedulingStates(input), generic.StringList, options);
}
export async function stateIsLeech(input: PlainMessage<scheduler.SchedulingState>, options?: PostProtoOptions): Promise<generic.Bool> {
        return await postProto("stateIsLeech", new scheduler.SchedulingState(input), generic.Bool, options);
}
export async function upgradeScheduler(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("upgradeScheduler", new generic.Empty(input), generic.Empty, options);
}
export async function customStudy(input: PlainMessage<scheduler.CustomStudyRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("customStudy", new scheduler.CustomStudyRequest(input), collection.OpChanges, options);
}
export async function customStudyDefaults(input: PlainMessage<scheduler.CustomStudyDefaultsRequest>, options?: PostProtoOptions): Promise<scheduler.CustomStudyDefaultsResponse> {
        return await postProto("customStudyDefaults", new scheduler.CustomStudyDefaultsRequest(input), scheduler.CustomStudyDefaultsResponse, options);
}
export async function repositionDefaults(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<scheduler.RepositionDefaultsResponse> {
        return await postProto("repositionDefaults", new generic.Empty(input), scheduler.RepositionDefaultsResponse, options);
}
export async function computeFsrsParams(input: PlainMessage<scheduler.ComputeFsrsParamsRequest>, options?: PostProtoOptions): Promise<scheduler.ComputeFsrsParamsResponse> {
        return await postProto("computeFsrsParams", new scheduler.ComputeFsrsParamsRequest(input), scheduler.ComputeFsrsParamsResponse, options);
}
export async function getOptimalRetentionParameters(input: PlainMessage<scheduler.GetOptimalRetentionParametersRequest>, options?: PostProtoOptions): Promise<scheduler.GetOptimalRetentionParametersResponse> {
        return await postProto("getOptimalRetentionParameters", new scheduler.GetOptimalRetentionParametersRequest(input), scheduler.GetOptimalRetentionParametersResponse, options);
}
export async function computeOptimalRetention(input: PlainMessage<scheduler.SimulateFsrsReviewRequest>, options?: PostProtoOptions): Promise<scheduler.ComputeOptimalRetentionResponse> {
        return await postProto("computeOptimalRetention", new scheduler.SimulateFsrsReviewRequest(input), scheduler.ComputeOptimalRetentionResponse, options);
}
export async function simulateFsrsReview(input: PlainMessage<scheduler.SimulateFsrsReviewRequest>, options?: PostProtoOptions): Promise<scheduler.SimulateFsrsReviewResponse> {
        return await postProto("simulateFsrsReview", new scheduler.SimulateFsrsReviewRequest(input), scheduler.SimulateFsrsReviewResponse, options);
}
export async function simulateFsrsWorkload(input: PlainMessage<scheduler.SimulateFsrsReviewRequest>, options?: PostProtoOptions): Promise<scheduler.SimulateFsrsWorkloadResponse> {
        return await postProto("simulateFsrsWorkload", new scheduler.SimulateFsrsReviewRequest(input), scheduler.SimulateFsrsWorkloadResponse, options);
}
export async function evaluateParams(input: PlainMessage<scheduler.EvaluateParamsRequest>, options?: PostProtoOptions): Promise<scheduler.EvaluateParamsResponse> {
        return await postProto("evaluateParams", new scheduler.EvaluateParamsRequest(input), scheduler.EvaluateParamsResponse, options);
}
export async function evaluateParamsLegacy(input: PlainMessage<scheduler.EvaluateParamsLegacyRequest>, options?: PostProtoOptions): Promise<scheduler.EvaluateParamsResponse> {
        return await postProto("evaluateParamsLegacy", new scheduler.EvaluateParamsLegacyRequest(input), scheduler.EvaluateParamsResponse, options);
}
export async function computeMemoryState(input: PlainMessage<cards.CardId>, options?: PostProtoOptions): Promise<scheduler.ComputeMemoryStateResponse> {
        return await postProto("computeMemoryState", new cards.CardId(input), scheduler.ComputeMemoryStateResponse, options);
}
/** The number of days the calculated interval was fuzzed by on the previous
 review (if any). Utilized by the FSRS add-on. */
export async function fuzzDelta(input: PlainMessage<scheduler.FuzzDeltaRequest>, options?: PostProtoOptions): Promise<scheduler.FuzzDeltaResponse> {
        return await postProto("fuzzDelta", new scheduler.FuzzDeltaRequest(input), scheduler.FuzzDeltaResponse, options);
}
export async function ankihubLogin(input: PlainMessage<ankihub.LoginRequest>, options?: PostProtoOptions): Promise<ankihub.LoginResponse> {
        return await postProto("ankihubLogin", new ankihub.LoginRequest(input), ankihub.LoginResponse, options);
}
export async function ankihubLogout(input: PlainMessage<ankihub.LogoutRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("ankihubLogout", new ankihub.LogoutRequest(input), generic.Empty, options);
}
/** Fetch info on add-ons from AnkiWeb. A maximum of 25 can be queried at one
 time. If an add-on doesn't have a branch compatible with the provided
 version, that add-on will not be included in the returned list. */
export async function getAddonInfo(input: PlainMessage<ankiweb.GetAddonInfoRequest>, options?: PostProtoOptions): Promise<ankiweb.GetAddonInfoResponse> {
        return await postProto("getAddonInfo", new ankiweb.GetAddonInfoRequest(input), ankiweb.GetAddonInfoResponse, options);
}
export async function checkForUpdate(input: PlainMessage<ankiweb.CheckForUpdateRequest>, options?: PostProtoOptions): Promise<ankiweb.CheckForUpdateResponse> {
        return await postProto("checkForUpdate", new ankiweb.CheckForUpdateRequest(input), ankiweb.CheckForUpdateResponse, options);
}
export async function helpPageLink(input: PlainMessage<links.HelpPageLinkRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("helpPageLink", new links.HelpPageLinkRequest(input), generic.String, options);
}
export async function addNotetype(input: PlainMessage<notetypes.Notetype>, options?: PostProtoOptions): Promise<collection.OpChangesWithId> {
        return await postProto("addNotetype", new notetypes.Notetype(input), collection.OpChangesWithId, options);
}
export async function updateNotetype(input: PlainMessage<notetypes.Notetype>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateNotetype", new notetypes.Notetype(input), collection.OpChanges, options);
}
export async function addNotetypeLegacy(input: PlainMessage<generic.Json>, options?: PostProtoOptions): Promise<collection.OpChangesWithId> {
        return await postProto("addNotetypeLegacy", new generic.Json(input), collection.OpChangesWithId, options);
}
export async function updateNotetypeLegacy(input: PlainMessage<notetypes.UpdateNotetypeLegacyRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateNotetypeLegacy", new notetypes.UpdateNotetypeLegacyRequest(input), collection.OpChanges, options);
}
export async function addOrUpdateNotetype(input: PlainMessage<notetypes.AddOrUpdateNotetypeRequest>, options?: PostProtoOptions): Promise<notetypes.NotetypeId> {
        return await postProto("addOrUpdateNotetype", new notetypes.AddOrUpdateNotetypeRequest(input), notetypes.NotetypeId, options);
}
export async function getStockNotetypeLegacy(input: PlainMessage<notetypes.StockNotetype>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getStockNotetypeLegacy", new notetypes.StockNotetype(input), generic.Json, options);
}
export async function getNotetype(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<notetypes.Notetype> {
        return await postProto("getNotetype", new notetypes.NotetypeId(input), notetypes.Notetype, options);
}
export async function getNotetypeLegacy(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("getNotetypeLegacy", new notetypes.NotetypeId(input), generic.Json, options);
}
export async function getNotetypeNames(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<notetypes.NotetypeNames> {
        return await postProto("getNotetypeNames", new generic.Empty(input), notetypes.NotetypeNames, options);
}
export async function getNotetypeNamesAndCounts(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<notetypes.NotetypeUseCounts> {
        return await postProto("getNotetypeNamesAndCounts", new generic.Empty(input), notetypes.NotetypeUseCounts, options);
}
export async function getNotetypeIdByName(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<notetypes.NotetypeId> {
        return await postProto("getNotetypeIdByName", new generic.String(input), notetypes.NotetypeId, options);
}
export async function removeNotetype(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("removeNotetype", new notetypes.NotetypeId(input), collection.OpChanges, options);
}
export async function getAuxNotetypeConfigKey(input: PlainMessage<notetypes.GetAuxConfigKeyRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("getAuxNotetypeConfigKey", new notetypes.GetAuxConfigKeyRequest(input), generic.String, options);
}
export async function getAuxTemplateConfigKey(input: PlainMessage<notetypes.GetAuxTemplateConfigKeyRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("getAuxTemplateConfigKey", new notetypes.GetAuxTemplateConfigKeyRequest(input), generic.String, options);
}
export async function getChangeNotetypeInfo(input: PlainMessage<notetypes.GetChangeNotetypeInfoRequest>, options?: PostProtoOptions): Promise<notetypes.ChangeNotetypeInfo> {
        return await postProto("getChangeNotetypeInfo", new notetypes.GetChangeNotetypeInfoRequest(input), notetypes.ChangeNotetypeInfo, options);
}
export async function changeNotetype(input: PlainMessage<notetypes.ChangeNotetypeRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("changeNotetype", new notetypes.ChangeNotetypeRequest(input), collection.OpChanges, options);
}
export async function getFieldNames(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<generic.StringList> {
        return await postProto("getFieldNames", new notetypes.NotetypeId(input), generic.StringList, options);
}
export async function restoreNotetypeToStock(input: PlainMessage<notetypes.RestoreNotetypeToStockRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("restoreNotetypeToStock", new notetypes.RestoreNotetypeToStockRequest(input), collection.OpChanges, options);
}
export async function getClozeFieldOrds(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<notetypes.GetClozeFieldOrdsResponse> {
        return await postProto("getClozeFieldOrds", new notetypes.NotetypeId(input), notetypes.GetClozeFieldOrdsResponse, options);
}
export async function newNote(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<notes.Note> {
        return await postProto("newNote", new notetypes.NotetypeId(input), notes.Note, options);
}
export async function addNote(input: PlainMessage<notes.AddNoteRequest>, options?: PostProtoOptions): Promise<notes.AddNoteResponse> {
        return await postProto("addNote", new notes.AddNoteRequest(input), notes.AddNoteResponse, options);
}
export async function addNotes(input: PlainMessage<notes.AddNotesRequest>, options?: PostProtoOptions): Promise<notes.AddNotesResponse> {
        return await postProto("addNotes", new notes.AddNotesRequest(input), notes.AddNotesResponse, options);
}
export async function defaultsForAdding(input: PlainMessage<notes.DefaultsForAddingRequest>, options?: PostProtoOptions): Promise<notes.DeckAndNotetype> {
        return await postProto("defaultsForAdding", new notes.DefaultsForAddingRequest(input), notes.DeckAndNotetype, options);
}
export async function defaultDeckForNotetype(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<decks.DeckId> {
        return await postProto("defaultDeckForNotetype", new notetypes.NotetypeId(input), decks.DeckId, options);
}
export async function updateNotes(input: PlainMessage<notes.UpdateNotesRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateNotes", new notes.UpdateNotesRequest(input), collection.OpChanges, options);
}
export async function getNote(input: PlainMessage<notes.NoteId>, options?: PostProtoOptions): Promise<notes.Note> {
        return await postProto("getNote", new notes.NoteId(input), notes.Note, options);
}
export async function removeNotes(input: PlainMessage<notes.RemoveNotesRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("removeNotes", new notes.RemoveNotesRequest(input), collection.OpChangesWithCount, options);
}
export async function clozeNumbersInNote(input: PlainMessage<notes.Note>, options?: PostProtoOptions): Promise<notes.ClozeNumbersInNoteResponse> {
        return await postProto("clozeNumbersInNote", new notes.Note(input), notes.ClozeNumbersInNoteResponse, options);
}
export async function afterNoteUpdates(input: PlainMessage<notes.AfterNoteUpdatesRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("afterNoteUpdates", new notes.AfterNoteUpdatesRequest(input), collection.OpChangesWithCount, options);
}
export async function fieldNamesForNotes(input: PlainMessage<notes.FieldNamesForNotesRequest>, options?: PostProtoOptions): Promise<notes.FieldNamesForNotesResponse> {
        return await postProto("fieldNamesForNotes", new notes.FieldNamesForNotesRequest(input), notes.FieldNamesForNotesResponse, options);
}
export async function noteFieldsCheck(input: PlainMessage<notes.Note>, options?: PostProtoOptions): Promise<notes.NoteFieldsCheckResponse> {
        return await postProto("noteFieldsCheck", new notes.Note(input), notes.NoteFieldsCheckResponse, options);
}
export async function cardsOfNote(input: PlainMessage<notes.NoteId>, options?: PostProtoOptions): Promise<cards.CardIds> {
        return await postProto("cardsOfNote", new notes.NoteId(input), cards.CardIds, options);
}
export async function getSingleNotetypeOfNotes(input: PlainMessage<notes.NoteIds>, options?: PostProtoOptions): Promise<notetypes.NotetypeId> {
        return await postProto("getSingleNotetypeOfNotes", new notes.NoteIds(input), notetypes.NotetypeId, options);
}
export async function stripHtml(input: PlainMessage<cardRendering.StripHtmlRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("stripHtml", new cardRendering.StripHtmlRequest(input), generic.String, options);
}
export async function allTtsVoices(input: PlainMessage<cardRendering.AllTtsVoicesRequest>, options?: PostProtoOptions): Promise<cardRendering.AllTtsVoicesResponse> {
        return await postProto("allTtsVoices", new cardRendering.AllTtsVoicesRequest(input), cardRendering.AllTtsVoicesResponse, options);
}
export async function writeTtsStream(input: PlainMessage<cardRendering.WriteTtsStreamRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("writeTtsStream", new cardRendering.WriteTtsStreamRequest(input), generic.Empty, options);
}
export async function extractAvTags(input: PlainMessage<cardRendering.ExtractAvTagsRequest>, options?: PostProtoOptions): Promise<cardRendering.ExtractAvTagsResponse> {
        return await postProto("extractAvTags", new cardRendering.ExtractAvTagsRequest(input), cardRendering.ExtractAvTagsResponse, options);
}
export async function extractLatex(input: PlainMessage<cardRendering.ExtractLatexRequest>, options?: PostProtoOptions): Promise<cardRendering.ExtractLatexResponse> {
        return await postProto("extractLatex", new cardRendering.ExtractLatexRequest(input), cardRendering.ExtractLatexResponse, options);
}
export async function getEmptyCards(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<cardRendering.EmptyCardsReport> {
        return await postProto("getEmptyCards", new generic.Empty(input), cardRendering.EmptyCardsReport, options);
}
export async function renderExistingCard(input: PlainMessage<cardRendering.RenderExistingCardRequest>, options?: PostProtoOptions): Promise<cardRendering.RenderCardResponse> {
        return await postProto("renderExistingCard", new cardRendering.RenderExistingCardRequest(input), cardRendering.RenderCardResponse, options);
}
export async function renderUncommittedCard(input: PlainMessage<cardRendering.RenderUncommittedCardRequest>, options?: PostProtoOptions): Promise<cardRendering.RenderCardResponse> {
        return await postProto("renderUncommittedCard", new cardRendering.RenderUncommittedCardRequest(input), cardRendering.RenderCardResponse, options);
}
export async function renderUncommittedCardLegacy(input: PlainMessage<cardRendering.RenderUncommittedCardLegacyRequest>, options?: PostProtoOptions): Promise<cardRendering.RenderCardResponse> {
        return await postProto("renderUncommittedCardLegacy", new cardRendering.RenderUncommittedCardLegacyRequest(input), cardRendering.RenderCardResponse, options);
}
export async function stripAvTags(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("stripAvTags", new generic.String(input), generic.String, options);
}
export async function renderMarkdown(input: PlainMessage<cardRendering.RenderMarkdownRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("renderMarkdown", new cardRendering.RenderMarkdownRequest(input), generic.String, options);
}
export async function encodeIriPaths(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("encodeIriPaths", new generic.String(input), generic.String, options);
}
export async function decodeIriPaths(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("decodeIriPaths", new generic.String(input), generic.String, options);
}
export async function htmlToTextLine(input: PlainMessage<cardRendering.HtmlToTextLineRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("htmlToTextLine", new cardRendering.HtmlToTextLineRequest(input), generic.String, options);
}
export async function compareAnswer(input: PlainMessage<cardRendering.CompareAnswerRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("compareAnswer", new cardRendering.CompareAnswerRequest(input), generic.String, options);
}
export async function extractClozeForTyping(input: PlainMessage<cardRendering.ExtractClozeForTypingRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("extractClozeForTyping", new cardRendering.ExtractClozeForTypingRequest(input), generic.String, options);
}
export async function buildSearchString(input: PlainMessage<search.SearchNode>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("buildSearchString", new search.SearchNode(input), generic.String, options);
}
export async function searchCards(input: PlainMessage<search.SearchRequest>, options?: PostProtoOptions): Promise<search.SearchResponse> {
        return await postProto("searchCards", new search.SearchRequest(input), search.SearchResponse, options);
}
export async function searchNotes(input: PlainMessage<search.SearchRequest>, options?: PostProtoOptions): Promise<search.SearchResponse> {
        return await postProto("searchNotes", new search.SearchRequest(input), search.SearchResponse, options);
}
export async function joinSearchNodes(input: PlainMessage<search.JoinSearchNodesRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("joinSearchNodes", new search.JoinSearchNodesRequest(input), generic.String, options);
}
export async function replaceSearchNode(input: PlainMessage<search.ReplaceSearchNodeRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("replaceSearchNode", new search.ReplaceSearchNodeRequest(input), generic.String, options);
}
export async function findAndReplace(input: PlainMessage<search.FindAndReplaceRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("findAndReplace", new search.FindAndReplaceRequest(input), collection.OpChangesWithCount, options);
}
export async function allBrowserColumns(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<search.BrowserColumns> {
        return await postProto("allBrowserColumns", new generic.Empty(input), search.BrowserColumns, options);
}
export async function browserRowForId(input: PlainMessage<generic.Int64>, options?: PostProtoOptions): Promise<search.BrowserRow> {
        return await postProto("browserRowForId", new generic.Int64(input), search.BrowserRow, options);
}
export async function setActiveBrowserColumns(input: PlainMessage<generic.StringList>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("setActiveBrowserColumns", new generic.StringList(input), generic.Empty, options);
}
/** Returns values from the reviewer */
export async function getSchedulingStatesWithContext(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<frontend.SchedulingStatesWithContext> {
        return await postProto("getSchedulingStatesWithContext", new generic.Empty(input), frontend.SchedulingStatesWithContext, options);
}
/** Updates reviewer state */
export async function setSchedulingStates(input: PlainMessage<frontend.SetSchedulingStatesRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("setSchedulingStates", new frontend.SetSchedulingStatesRequest(input), generic.Empty, options);
}
/** Notify Qt layer so window modality can be updated. */
export async function importDone(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("importDone", new generic.Empty(input), generic.Empty, options);
}
export async function searchInBrowser(input: PlainMessage<search.SearchNode>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("searchInBrowser", new search.SearchNode(input), generic.Empty, options);
}
/** Force closing the deck options. */
export async function deckOptionsRequireClose(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("deckOptionsRequireClose", new generic.Empty(input), generic.Empty, options);
}
/** Warns python that the deck option web view is ready to receive requests. */
export async function deckOptionsReady(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("deckOptionsReady", new generic.Empty(input), generic.Empty, options);
}
export async function translateString(input: PlainMessage<i18n.TranslateStringRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("translateString", new i18n.TranslateStringRequest(input), generic.String, options);
}
export async function formatTimespan(input: PlainMessage<i18n.FormatTimespanRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("formatTimespan", new i18n.FormatTimespanRequest(input), generic.String, options);
}
export async function i18nResources(input: PlainMessage<i18n.I18nResourcesRequest>, options?: PostProtoOptions): Promise<generic.Json> {
        return await postProto("i18nResources", new i18n.I18nResourcesRequest(input), generic.Json, options);
}
export async function getImageForOcclusion(input: PlainMessage<imageOcclusion.GetImageForOcclusionRequest>, options?: PostProtoOptions): Promise<imageOcclusion.GetImageForOcclusionResponse> {
        return await postProto("getImageForOcclusion", new imageOcclusion.GetImageForOcclusionRequest(input), imageOcclusion.GetImageForOcclusionResponse, options);
}
export async function getImageOcclusionNote(input: PlainMessage<imageOcclusion.GetImageOcclusionNoteRequest>, options?: PostProtoOptions): Promise<imageOcclusion.GetImageOcclusionNoteResponse> {
        return await postProto("getImageOcclusionNote", new imageOcclusion.GetImageOcclusionNoteRequest(input), imageOcclusion.GetImageOcclusionNoteResponse, options);
}
export async function getImageOcclusionFields(input: PlainMessage<imageOcclusion.GetImageOcclusionFieldsRequest>, options?: PostProtoOptions): Promise<imageOcclusion.GetImageOcclusionFieldsResponse> {
        return await postProto("getImageOcclusionFields", new imageOcclusion.GetImageOcclusionFieldsRequest(input), imageOcclusion.GetImageOcclusionFieldsResponse, options);
}
/** Adds an I/O notetype if none exists in the collection. */
export async function addImageOcclusionNotetype(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("addImageOcclusionNotetype", new generic.Empty(input), collection.OpChanges, options);
}
/** These two are used by the standalone I/O page, but not used when using
 I/O inside Anki's editor */
export async function addImageOcclusionNote(input: PlainMessage<imageOcclusion.AddImageOcclusionNoteRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("addImageOcclusionNote", new imageOcclusion.AddImageOcclusionNoteRequest(input), collection.OpChanges, options);
}
export async function updateImageOcclusionNote(input: PlainMessage<imageOcclusion.UpdateImageOcclusionNoteRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("updateImageOcclusionNote", new imageOcclusion.UpdateImageOcclusionNoteRequest(input), collection.OpChanges, options);
}
export async function importCollectionPackage(input: PlainMessage<importExport.ImportCollectionPackageRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("importCollectionPackage", new importExport.ImportCollectionPackageRequest(input), generic.Empty, options);
}
export async function exportCollectionPackage(input: PlainMessage<importExport.ExportCollectionPackageRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("exportCollectionPackage", new importExport.ExportCollectionPackageRequest(input), generic.Empty, options);
}
export async function importAnkiPackage(input: PlainMessage<importExport.ImportAnkiPackageRequest>, options?: PostProtoOptions): Promise<importExport.ImportResponse> {
        return await postProto("importAnkiPackage", new importExport.ImportAnkiPackageRequest(input), importExport.ImportResponse, options);
}
export async function getImportAnkiPackagePresets(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<importExport.ImportAnkiPackageOptions> {
        return await postProto("getImportAnkiPackagePresets", new generic.Empty(input), importExport.ImportAnkiPackageOptions, options);
}
export async function exportAnkiPackage(input: PlainMessage<importExport.ExportAnkiPackageRequest>, options?: PostProtoOptions): Promise<generic.UInt32> {
        return await postProto("exportAnkiPackage", new importExport.ExportAnkiPackageRequest(input), generic.UInt32, options);
}
export async function getCsvMetadata(input: PlainMessage<importExport.CsvMetadataRequest>, options?: PostProtoOptions): Promise<importExport.CsvMetadata> {
        return await postProto("getCsvMetadata", new importExport.CsvMetadataRequest(input), importExport.CsvMetadata, options);
}
export async function importCsv(input: PlainMessage<importExport.ImportCsvRequest>, options?: PostProtoOptions): Promise<importExport.ImportResponse> {
        return await postProto("importCsv", new importExport.ImportCsvRequest(input), importExport.ImportResponse, options);
}
export async function exportNoteCsv(input: PlainMessage<importExport.ExportNoteCsvRequest>, options?: PostProtoOptions): Promise<generic.UInt32> {
        return await postProto("exportNoteCsv", new importExport.ExportNoteCsvRequest(input), generic.UInt32, options);
}
export async function exportCardCsv(input: PlainMessage<importExport.ExportCardCsvRequest>, options?: PostProtoOptions): Promise<generic.UInt32> {
        return await postProto("exportCardCsv", new importExport.ExportCardCsvRequest(input), generic.UInt32, options);
}
export async function importJsonFile(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<importExport.ImportResponse> {
        return await postProto("importJsonFile", new generic.String(input), importExport.ImportResponse, options);
}
export async function importJsonString(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<importExport.ImportResponse> {
        return await postProto("importJsonString", new generic.String(input), importExport.ImportResponse, options);
}
export async function checkMedia(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<media.CheckMediaResponse> {
        return await postProto("checkMedia", new generic.Empty(input), media.CheckMediaResponse, options);
}
export async function addMediaFile(input: PlainMessage<media.AddMediaFileRequest>, options?: PostProtoOptions): Promise<generic.String> {
        return await postProto("addMediaFile", new media.AddMediaFileRequest(input), generic.String, options);
}
export async function trashMediaFiles(input: PlainMessage<media.TrashMediaFilesRequest>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("trashMediaFiles", new media.TrashMediaFilesRequest(input), generic.Empty, options);
}
export async function emptyTrash(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("emptyTrash", new generic.Empty(input), generic.Empty, options);
}
export async function restoreTrash(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("restoreTrash", new generic.Empty(input), generic.Empty, options);
}
export async function extractStaticMediaFiles(input: PlainMessage<notetypes.NotetypeId>, options?: PostProtoOptions): Promise<generic.StringList> {
        return await postProto("extractStaticMediaFiles", new notetypes.NotetypeId(input), generic.StringList, options);
}
export async function cardStats(input: PlainMessage<cards.CardId>, options?: PostProtoOptions): Promise<stats.CardStatsResponse> {
        return await postProto("cardStats", new cards.CardId(input), stats.CardStatsResponse, options);
}
export async function getReviewLogs(input: PlainMessage<cards.CardId>, options?: PostProtoOptions): Promise<stats.ReviewLogs> {
        return await postProto("getReviewLogs", new cards.CardId(input), stats.ReviewLogs, options);
}
export async function graphs(input: PlainMessage<stats.GraphsRequest>, options?: PostProtoOptions): Promise<stats.GraphsResponse> {
        return await postProto("graphs", new stats.GraphsRequest(input), stats.GraphsResponse, options);
}
export async function getGraphPreferences(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<stats.GraphPreferences> {
        return await postProto("getGraphPreferences", new generic.Empty(input), stats.GraphPreferences, options);
}
export async function setGraphPreferences(input: PlainMessage<stats.GraphPreferences>, options?: PostProtoOptions): Promise<generic.Empty> {
        return await postProto("setGraphPreferences", new stats.GraphPreferences(input), generic.Empty, options);
}
export async function clearUnusedTags(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("clearUnusedTags", new generic.Empty(input), collection.OpChangesWithCount, options);
}
export async function allTags(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<generic.StringList> {
        return await postProto("allTags", new generic.Empty(input), generic.StringList, options);
}
export async function removeTags(input: PlainMessage<generic.String>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("removeTags", new generic.String(input), collection.OpChangesWithCount, options);
}
export async function setTagCollapsed(input: PlainMessage<tags.SetTagCollapsedRequest>, options?: PostProtoOptions): Promise<collection.OpChanges> {
        return await postProto("setTagCollapsed", new tags.SetTagCollapsedRequest(input), collection.OpChanges, options);
}
export async function tagTree(input: PlainMessage<generic.Empty>, options?: PostProtoOptions): Promise<tags.TagTreeNode> {
        return await postProto("tagTree", new generic.Empty(input), tags.TagTreeNode, options);
}
export async function reparentTags(input: PlainMessage<tags.ReparentTagsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("reparentTags", new tags.ReparentTagsRequest(input), collection.OpChangesWithCount, options);
}
export async function renameTags(input: PlainMessage<tags.RenameTagsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("renameTags", new tags.RenameTagsRequest(input), collection.OpChangesWithCount, options);
}
export async function addNoteTags(input: PlainMessage<tags.NoteIdsAndTagsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("addNoteTags", new tags.NoteIdsAndTagsRequest(input), collection.OpChangesWithCount, options);
}
export async function removeNoteTags(input: PlainMessage<tags.NoteIdsAndTagsRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("removeNoteTags", new tags.NoteIdsAndTagsRequest(input), collection.OpChangesWithCount, options);
}
export async function findAndReplaceTag(input: PlainMessage<tags.FindAndReplaceTagRequest>, options?: PostProtoOptions): Promise<collection.OpChangesWithCount> {
        return await postProto("findAndReplaceTag", new tags.FindAndReplaceTagRequest(input), collection.OpChangesWithCount, options);
}
export async function completeTag(input: PlainMessage<tags.CompleteTagRequest>, options?: PostProtoOptions): Promise<tags.CompleteTagResponse> {
        return await postProto("completeTag", new tags.CompleteTagRequest(input), tags.CompleteTagResponse, options);
}
