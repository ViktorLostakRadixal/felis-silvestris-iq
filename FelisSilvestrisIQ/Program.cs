using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using System.Security.Authentication;

var builder = WebApplication.CreateBuilder(args);

// --- Swagger/OpenAPI Configuration ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// --- MongoDB Service Configuration ---
builder.Services.AddSingleton<MongoService>();

// --- NEW: Add CORS services ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowDevelopment",
        policy =>
        {
            // Allow requests from the typical HTTPS development URL
            policy.WithOrigins("https://localhost:7045")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});


var app = builder.Build();

// --- Configure the HTTP request pipeline ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// --- NEW: Apply the CORS policy ---
// IMPORTANT: This must be called BEFORE UseStaticFiles, UseDefaultFiles, and endpoint mapping.
app.UseCors("AllowDevelopment");

app.UseDefaultFiles();
app.UseStaticFiles();


// =========================================================================
// API ENDPOINTS
// =========================================================================

app.MapGet("/api/healthcheck", async (MongoService mongoService) =>
{
    try
    {
        await mongoService.PingAsync();
        return Results.Ok(new { status = "OK", message = "Successfully connected to MongoDB." });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Health check failed.");
        return Results.Ok(new { status = "Error", message = ex.Message });
    }
});


app.MapPost("/api/sessions", async (SessionSetupData setupData, MongoService mongoService) =>
{
    try
    {
        var newSession = new SessionData
        {
            Id = Guid.NewGuid(),
            SetupInfo = setupData.SetupInfo,
            LocationInfo = setupData.LocationInfo,
            UserAgent = setupData.UserAgent,
            Device = setupData.Device,
            ClientStartTime = setupData.ClientStartTime,
            Events = new List<Event>()
        };

        await mongoService.CreateSessionAsync(newSession);
        return Results.Ok(new { id = newSession.Id.ToString() });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error creating session.");
        return Results.Problem("An error occurred while creating the session.", statusCode: 500);
    }
});

app.MapPut("/api/sessions/{id}", async (Guid id, List<Event> newEvents, MongoService mongoService) =>
{
    try
    {
        var success = await mongoService.AppendEventsAsync(id, newEvents);
        if (success)
        {
            return Results.Ok(new { message = "Events appended successfully." });
        }
        return Results.NotFound(new { message = "Session not found." });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error appending events.");
        return Results.Problem("An error occurred while appending events.", statusCode: 500);
    }
});


app.Run();

// =========================================================================
// DATA MODELS
// =========================================================================

public class SessionSetupData
{
    public required string SetupInfo { get; set; }
    public required LocationInfo LocationInfo { get; set; }
    public required string UserAgent { get; set; }
    public required DeviceInfo Device { get; set; }
    public DateTime ClientStartTime { get; set; }
}

public class SessionData
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }
    public required string SetupInfo { get; set; }
    public required LocationInfo LocationInfo { get; set; }
    public required string UserAgent { get; set; }
    public required DeviceInfo Device { get; set; }
    public DateTime ClientStartTime { get; set; }
    public DateTime? ClientEndTime { get; set; }
    public required List<Event> Events { get; set; }
}

public record Event(long Timestamp, string EventType, object Data);
public record DeviceInfo(ViewportInfo Viewport, ScreenInfo Screen);
public record ViewportInfo(int Width, int Height);
public record ScreenInfo(int Width, int Height, double PixelRatio);
public record LocationInfo(double? Latitude, double? Longitude, string? Error);

// =========================================================================
// MONGODB SERVICE
// =========================================================================
public class MongoService
{
    private readonly IMongoCollection<SessionData> _sessionCollection;
    private readonly IMongoDatabase _database;
    private readonly ILogger<MongoService> _logger;

    public MongoService(IConfiguration configuration, ILogger<MongoService> logger)
    {
        _logger = logger;
        var connectionString = configuration.GetConnectionString("MongoDbConnection");
        if (string.IsNullOrEmpty(connectionString)) throw new InvalidOperationException("MongoDB connection string not found.");

        var settings = MongoClientSettings.FromUrl(new MongoUrl(connectionString));
        settings.SslSettings = new SslSettings() { EnabledSslProtocols = SslProtocols.Tls12 };
        var mongoClient = new MongoClient(settings);

        _database = mongoClient.GetDatabase("FelisIQ");
        _sessionCollection = _database.GetCollection<SessionData>("TestSessions");
    }

    public async Task PingAsync()
    {
        await _database.RunCommandAsync((Command<BsonDocument>)"{ping:1}");
        _logger.LogInformation("MongoDB ping successful.");
    }

    public async Task CreateSessionAsync(SessionData session)
    {
        await _sessionCollection.InsertOneAsync(session);
        _logger.LogInformation("Created session with ID: {SessionId}", session.Id);
    }

    public async Task<bool> AppendEventsAsync(Guid id, List<Event> events)
    {
        var filter = Builders<SessionData>.Filter.Eq(s => s.Id, id);
        var update = Builders<SessionData>.Update.PushEach(s => s.Events, events);

        var result = await _sessionCollection.UpdateOneAsync(filter, update);
        if (result.IsAcknowledged && result.ModifiedCount > 0)
        {
            _logger.LogInformation("Appended {EventCount} events to session {SessionId}", events.Count, id);
            return true;
        }
        _logger.LogWarning("Attempted to update session {SessionId}, but it was not found.", id);
        return false;
    }
}
