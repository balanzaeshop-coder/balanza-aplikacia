import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Shared helpers

private func fmtTime(_ s: Int) -> String {
    let h = s / 3600; let m = (s % 3600) / 60; let sec = s % 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec)
                 : String(format: "%02d:%02d", m, sec)
}

// MARK: - Home‑screen widget data (App Groups)

private let appGroup = "group.sk.balanza.walkingpad"
private let dataKey  = "widget_data"

struct HomeWidgetData {
    var steps: Int = 0;  var km: Double = 0;  var minutes: Int  = 0
    var stepsGoal: Int = 8000; var kmGoal: Double = 5; var minutesGoal: Int = 60

    static func load() -> HomeWidgetData {
        guard let def = UserDefaults(suiteName: appGroup),
              let json = def.string(forKey: dataKey),
              let raw  = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: raw) as? [String: Any]
        else { return HomeWidgetData() }
        var d = HomeWidgetData()
        d.steps       = dict["steps"]       as? Int    ?? 0
        d.km          = dict["km"]          as? Double ?? 0
        d.minutes     = dict["minutes"]     as? Int    ?? 0
        d.stepsGoal   = dict["stepsGoal"]   as? Int    ?? 8000
        d.kmGoal      = dict["kmGoal"]      as? Double ?? 5
        d.minutesGoal = dict["minutesGoal"] as? Int    ?? 60
        return d
    }
}

// MARK: - Home‑screen widget

struct BalanzaEntry: TimelineEntry { let date: Date; let data: HomeWidgetData }

struct BalanzaProvider: TimelineProvider {
    func placeholder(in _: Context) -> BalanzaEntry { BalanzaEntry(date: .now, data: .init()) }
    func getSnapshot(in _: Context, completion: @escaping (BalanzaEntry) -> Void) { completion(.init(date: .now, data: .load())) }
    func getTimeline(in _: Context, completion: @escaping (Timeline<BalanzaEntry>) -> Void) {
        let e = BalanzaEntry(date: .now, data: .load())
        completion(Timeline(entries: [e], policy: .after(Calendar.current.date(byAdding: .minute, value: 5, to: .now)!)))
    }
}

struct RingView: View {
    let progress: Double; let color: Color; let label: String; let value: String
    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                Circle().stroke(color.opacity(0.18), lineWidth: 5)
                Circle().trim(from: 0, to: min(max(progress,0),1))
                    .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(value).font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
            }.frame(width: 52, height: 52)
            Text(label).font(.system(size: 9, weight: .semibold)).foregroundColor(.secondary)
        }
    }
}

struct BalanzaWidgetView: View {
    let entry: BalanzaEntry
    private var stepsLabel: String { entry.data.steps >= 1000 ? String(format:"%.1fk", Double(entry.data.steps)/1000) : "\(entry.data.steps)" }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Balanza").font(.system(size:12,weight:.bold)).foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
            HStack(spacing: 10) {
                RingView(progress: Double(entry.data.steps)/Double(entry.data.stepsGoal), color: Color(red:0.17,green:0.16,blue:0.24), label:"kroky", value: stepsLabel)
                RingView(progress: entry.data.km/entry.data.kmGoal, color: Color(red:0.49,green:0.44,blue:0.80), label:"km", value: String(format:"%.1f",entry.data.km))
                RingView(progress: Double(entry.data.minutes)/Double(entry.data.minutesGoal), color: Color(red:0.72,green:0.68,blue:0.91), label:"min", value:"\(entry.data.minutes)")
            }
        }
        .padding(14).frame(maxWidth:.infinity, maxHeight:.infinity, alignment:.leading)
    }
}

struct BalanzaWidget: Widget {
    let kind = "BalanzaWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BalanzaProvider()) { entry in
            if #available(iOS 17.0, *) {
                BalanzaWidgetView(entry: entry).containerBackground(Color(red:0.93,green:0.92,blue:0.96), for:.widget)
            } else {
                BalanzaWidgetView(entry: entry).background(Color(red:0.93,green:0.92,blue:0.96))
            }
        }
        .configurationDisplayName("Balanza").description("Dnešné štatistiky chôdze").supportedFamilies([.systemSmall])
    }
}

// MARK: - Live Activity (Lock Screen + Dynamic Island)

@available(iOS 16.2, *)
struct BalanzaLockScreenView: View {
    let context: ActivityViewContext<BalanzaActivityAttributes>
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Balanza").font(.caption2.bold()).foregroundColor(.secondary)
                Spacer()
                Text("Tréning prebieha").font(.caption2).foregroundColor(.secondary)
            }.padding(.horizontal, 16).padding(.top, 12)

            HStack(spacing: 0) {
                LiveStat(value: String(format:"%.1f", context.state.speed), label:"km/h", big: true)
                Divider().frame(height: 40)
                LiveStat(value: fmtTime(context.state.seconds), label:"čas", big: false)
                Divider().frame(height: 40)
                LiveStat(value: String(format:"%.2f", context.state.km), label:"km", big: false)
                Divider().frame(height: 40)
                LiveStat(value: context.state.steps >= 1000
                         ? String(format:"%.1fk", Double(context.state.steps)/1000)
                         : "\(context.state.steps)", label:"kroky", big: false)
            }.padding(.horizontal, 16).padding(.vertical, 10)

            HStack(spacing: 10) {
                if #available(iOS 17.0, *) {
                    Button(intent: SpeedDownIntent()) {
                        Image(systemName: "minus.circle.fill")
                            .font(.system(size: 34))
                            .foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
                    }.buttonStyle(.plain)
                    Button(intent: StopBeltIntent()) {
                        HStack(spacing: 6) {
                            Image(systemName: "stop.fill").font(.caption.bold())
                            Text("Zastaviť pás").font(.caption.bold())
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(Color(red:0.17,green:0.16,blue:0.24))
                        .cornerRadius(10)
                    }.buttonStyle(.plain)
                    Button(intent: SpeedUpIntent()) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 34))
                            .foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
                    }.buttonStyle(.plain)
                } else {
                    Link(destination: URL(string:"balanza://speed-down")!) {
                        Image(systemName: "minus.circle.fill")
                            .font(.system(size: 34))
                            .foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
                    }
                    Link(destination: URL(string:"balanza://stop")!) {
                        HStack(spacing: 6) {
                            Image(systemName: "stop.fill").font(.caption.bold())
                            Text("Zastaviť pás").font(.caption.bold())
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(Color(red:0.17,green:0.16,blue:0.24))
                        .cornerRadius(10)
                    }
                    Link(destination: URL(string:"balanza://speed-up")!) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 34))
                            .foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
                    }
                }
            }.padding(.horizontal, 16).padding(.bottom, 12)
        }
        .background(Color(red:0.93,green:0.92,blue:0.96))
    }
}

@available(iOS 16.2, *)
private struct LiveStat: View {
    let value: String; let label: String; let big: Bool
    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(big ? .system(size:26,weight:.heavy) : .system(size:18,weight:.bold))
                .foregroundColor(Color(red:0.17,green:0.16,blue:0.24))
            Text(label).font(.system(size:10,weight:.semibold)).foregroundColor(.secondary)
        }.frame(maxWidth: .infinity)
    }
}

@available(iOS 16.2, *)
struct BalanzaLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BalanzaActivityAttributes.self) { context in
            BalanzaLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment:.leading, spacing:2) {
                        Text(context.state.steps >= 1000
                             ? String(format:"%.1fk", Double(context.state.steps)/1000)
                             : "\(context.state.steps)").font(.title2.bold())
                            .foregroundColor(.white)
                        Text("krokov").font(.caption2).foregroundColor(.white.opacity(0.6))
                    }.padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment:.trailing, spacing:2) {
                        Text(fmtTime(context.state.seconds)).font(.headline.bold())
                            .foregroundColor(.white)
                        Text(String(format:"%.2f km", context.state.km)).font(.caption2).foregroundColor(.white.opacity(0.6))
                    }.padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        if #available(iOS 17.0, *) {
                            Button(intent: SpeedDownIntent()) {
                                Image(systemName: "minus.circle.fill")
                                    .font(.title3).foregroundColor(.white)
                            }.buttonStyle(.plain)
                            Spacer()
                            Text("\(context.state.steps) krokov").font(.caption2).foregroundColor(.white.opacity(0.6))
                            Spacer()
                            Button(intent: SpeedUpIntent()) {
                                Image(systemName: "plus.circle.fill")
                                    .font(.title3).foregroundColor(.white)
                            }.buttonStyle(.plain)
                        } else {
                            Link(destination: URL(string:"balanza://speed-down")!) {
                                Image(systemName: "minus.circle.fill")
                                    .font(.title3).foregroundColor(.white)
                            }
                            Spacer()
                            Text("\(context.state.steps) krokov").font(.caption2).foregroundColor(.white.opacity(0.6))
                            Spacer()
                            Link(destination: URL(string:"balanza://speed-up")!) {
                                Image(systemName: "plus.circle.fill")
                                    .font(.title3).foregroundColor(.white)
                            }
                        }
                    }.padding(.horizontal, 4)
                }
            } compactLeading: {
                Text(context.state.steps >= 1000
                     ? String(format:"%.1fk", Double(context.state.steps)/1000)
                     : "\(context.state.steps)").font(.caption.bold())
                    .foregroundColor(.white)
            } compactTrailing: {
                Text("krokov").font(.caption2).foregroundColor(.white.opacity(0.7))
            } minimal: {
                Text(context.state.steps >= 1000
                     ? String(format:"%.1fk", Double(context.state.steps)/1000)
                     : "\(context.state.steps)").font(.caption2.bold())
                    .foregroundColor(.white)
            }
        }
    }
}

// MARK: - Bundle entry point

@main
struct BalanzaWidgetBundle: WidgetBundle {
    var body: some Widget {
        BalanzaWidget()
        if #available(iOS 16.2, *) { BalanzaLiveActivity() }
    }
}
