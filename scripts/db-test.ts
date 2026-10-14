import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { useStore } from "../src/lib/store";
import { setCached } from "../src/lib/cache";
import { isLocalAI } from "../src/lib/settings";
import { buildSaveBackup, importSaveBackup } from "../src/lib/export";

async function backupRoundTrip() {
  await db.delete();
  await db.open();
  const templates = {bookType: "fantasy", items: [{label:"traveler",identity:"scholar",faction:"academy",abilities:["read"],connections:["mentor"],power:"library",resources:["book"]}]};
  const bookId = await db.books.add({title:"round-trip",author:"author",totalChars:8,chapterCount:1,createdAt:1,lastReadIndex:0,templates});
  const saveId = await db.saves.add({bookId,name:"complete",pcId:0,offset:0.25,createdAt:2,lastChapterIndex:0});
  const pcId = await db.characters.add({saveId,name:"hero",isPC:true,identity:"scholar",faction:"academy",abilities:["read"],connections:["mentor"],power:"library",resources:["book"]});
  await db.saves.update(saveId,{pcId});
  await db.npcMemories.add({saveId,npcName:"mentor",attitude:"friendly",trust:0.7,remembered:["meeting"],tendency:"help",relationHistory:["met","trusted"]});
  await db.actions.bulkAdd([
    {saveId,chapterIndex:0,kind:"complex",content:"act",result:"result",createdAt:3,paraIndex:1,cost:0,promptTokens:12,completionTokens:34,cached:true},
    {saveId,chapterIndex:0,kind:"simple",content:"look",result:"seen",createdAt:4,paraIndex:0},
  ]);
  await db.systemStates.add({saveId,xp:120,level:2,points:17,redeemed:[{name:"item",at:5}],messages:["message"],readChapters:[0],regrets:["regret"],readingSeconds:123,quests:[{text:"quest",done:true}]});
  await db.highlights.add({saveId,chapterIndex:0,paraIndex:1,text:"note",createdAt:6});
  await db.bookmarks.add({saveId,chapterIndex:0,createdAt:7});
  useStore.setState({currentSaveId:saveId,currentBookId:bookId,chapterList:[]});
  await useStore.getState().createSavePoint("full snapshot");
  const backup = buildSaveBackup({
    book:(await db.books.get(bookId))!, save:(await db.saves.get(saveId))!, pc:(await db.characters.get(pcId))!,
    npcMemories:await db.npcMemories.toArray(), actions:await db.actions.toArray(),
    systemState:(await db.systemStates.toArray())[0], savePoints:await db.savePoints.toArray(),
    highlights:await db.highlights.toArray(), bookmarks:await db.bookmarks.toArray(),
  });
  const json = JSON.stringify(backup);
  await db.delete();
  await db.open();
  // Reimport the original book on a fresh device with different primary keys.
  const newBookId = await db.books.add({id:99,title:"round-trip",author:"author",totalChars:8,chapterCount:1,createdAt:8,lastReadIndex:0});
  await db.chapters.add({bookId:newBookId,index:0,title:"chapter",content:"original",charCount:8,nodes:[],actions:[]});
  const originalChapters = await db.chapters.toArray();
  await db.saves.add({...backup.save,id:99,bookId:newBookId});
  await db.saves.delete(99);
  await db.characters.add({...backup.pc,id:99,saveId:99});
  await db.characters.delete(99);
  const beforeImport = Date.now();
  assert.equal(await importSaveBackup(json),"round-trip");
  const saves = await db.saves.toArray();
  assert.equal(saves.length,1);
  const imported = saves[0];
  assert.notEqual(imported.id,backup.save.id);
  assert.notEqual(imported.pcId,backup.pc.id);
  assert.equal(imported.bookId,newBookId);
  assert.equal(imported.name,backup.save.name + "（导入）");
  assert.ok(imported.createdAt >= beforeImport && imported.createdAt <= Date.now());
  assert.equal(imported.offset,backup.save.offset);
  assert.equal(imported.lastChapterIndex,backup.save.lastChapterIndex);
  const stripKeys = (row: {id?:number;saveId:number}) => {
    const {id,saveId,...data} = row;
    return data;
  };
  const pairs = [
    [await db.characters.toArray(),[backup.pc]],
    [await db.npcMemories.toArray(),backup.npcMemories],
    [await db.actions.toArray(),backup.actions],
    [await db.savePoints.toArray(),backup.savePoints!],
    [await db.highlights.toArray(),backup.highlights!],
    [await db.bookmarks.toArray(),backup.bookmarks!],
  ] as const;
  for (const [actual,expected] of pairs) {
    assert.deepEqual(actual.map(stripKeys),expected.map(stripKeys));
    assert.ok(actual.every(row => row.saveId === imported.id));
  }
  assert.equal((await db.characters.toArray())[0].id,imported.pcId);
  const systems = await db.systemStates.toArray();
  assert.equal(systems.length,1);
  assert.equal(systems[0].saveId,imported.id);
  assert.deepEqual(stripKeys(systems[0]),backup.systemState);
  assert.deepEqual((await db.books.get(newBookId))!.templates,templates);
  assert.deepEqual(await db.chapters.toArray(),originalChapters);
  console.log("Backup round-trip passed: every saved table, templates, foreign keys and unchanged original text");
}

// 验证商城兑换的机械效果：兑换能力后自动加入角色能力栏，并正确扣点数。
async function redeemGrantsAbility() {
  await db.delete();
  await db.open();
  const bookId = await db.books.add({title:"mech",author:"",totalChars:0,chapterCount:0,createdAt:0,lastReadIndex:0});
  const saveId = await db.saves.add({bookId,name:"mech",pcId:0,offset:0,createdAt:0,lastChapterIndex:0});
  const pcId = await db.characters.add({saveId,name:"hero",isPC:true,identity:"x",faction:"x",abilities:["read"],connections:[],power:"x",resources:[]});
  await db.saves.update(saveId,{pcId});
  useStore.setState({currentBookId:bookId,currentSaveId:saveId,chapterList:[]});
  await useStore.getState().switchSave(saveId);
  const sys = (await db.systemStates.where("saveId").equals(saveId).first())!;
  await db.systemStates.update(sys.id!, {points:100});
  await useStore.getState().redeem("ability-temp");
  const pc = (await db.characters.get(pcId))!;
  assert.ok(pc.abilities.includes("临时技能"), "兑换能力后应自动加入角色能力栏");
  assert.equal((await db.systemStates.get(sys.id!))!.points, 80); // 100 - 20
  console.log("Mechanical effect passed: ability redemption appends to PC abilities");
}

async function main() {
  assert.equal(isLocalAI("https://localhost.example.com/v1"), false);
  assert.equal(isLocalAI("https://example.com/localhost"), false);
  assert.equal(isLocalAI("http://[::1]:11434/v1"), true);
  const bookId = await db.books.add({title:"test",author:"",totalChars:0,chapterCount:0,createdAt:0,lastReadIndex:0});
  const saveId = await db.saves.add({bookId,name:"test",pcId:0,offset:0,createdAt:0,lastChapterIndex:0});
  const pcId = await db.characters.add({saveId,name:"hero",isPC:true,identity:"scholar",faction:"academy",abilities:["read"],connections:[],power:"library",resources:[]});
  await db.saves.update(saveId,{pcId});
  useStore.setState({currentBookId:bookId,currentSaveId:saveId,chapterList:[]});
  await useStore.getState().switchSave(saveId);
  const fields = {xp:120,level:2,points:5,redeemed:[{name:"old",at:1}],messages:["old"],readChapters:[0],regrets:["old"],readingSeconds:10,quests:[{text:"old",done:true}]};
  const sys = (await db.systemStates.where("saveId").equals(saveId).first())!;
  await db.systemStates.update(sys.id!, fields);
  await useStore.getState().createSavePoint("test");
  const sp = (await db.savePoints.toArray())[0];
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) assert.deepEqual(sp[key], fields[key]);
  await Promise.all([useStore.getState().redeem("info-npc"),useStore.getState().redeem("info-npc")]);
  const redeemed = (await db.systemStates.get(sys.id!))!;
  assert.equal(redeemed.points,0);
  assert.equal(redeemed.redeemed.length,2);
  const npcIntel = redeemed.redeemed.find((r) => r.name === "NPC 情报");
  assert.ok(npcIntel && npcIntel.result && npcIntel.result.length > 0, "兑换后应产生具体情报内容");
  await Promise.all([useStore.getState().addReadingSeconds(10),useStore.getState().addReadingSeconds(20)]);
  assert.equal((await db.systemStates.get(sys.id!))!.readingSeconds,40);
  await useStore.getState().restoreSavePoint(sp.id!);
  const restored = (await db.systemStates.get(sys.id!))!;
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) assert.deepEqual(restored[key], fields[key]);
  await db.saves.update(saveId,{offset:0.5});
  await db.savePoints.update(sp.id!,{actions:[{saveId,chapterIndex:0,kind:"simple",content:"x",result:"x",createdAt:0}]});
  const fail = () => { throw new Error("injected write failure"); };
  db.actions.hook("creating",fail);
  await assert.rejects(useStore.getState().restoreSavePoint(sp.id!),/injected/);
  db.actions.hook("creating").unsubscribe(fail);
  assert.equal((await db.saves.get(saveId))!.offset,0.5);
  for(let i=0;i<501;i++) await setCached(String(i),{content:"x",promptTokens:0,completionTokens:0,cost:0});
  assert.equal(await db.aiCache.count(),500);
  assert.equal(await db.aiCache.where("key").equals("0").count(),0);
  console.log("DB tests passed: snapshot, restore, rollback, concurrent redeem/reading, cache eviction; URL boundaries");
  await backupRoundTrip();
  await redeemGrantsAbility();
  await db.delete();
}
main().catch(error => {console.error(error);process.exitCode=1;});
