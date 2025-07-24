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

var app = builder.Build();

// --- Configure the HTTP request pipeline ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles(); // Enables serving index.html
app.UseStaticFiles();  // Enables serving files from wwwroot

// --- API Endpoint (no changes needed here, logic is in the service) ---
app.MapPost("/api/log", async (SessionData sessionData, MongoService mongoService) =>
{
    try
    {
        var insertedId = await mongoService.CreateLogEntryAsync(sessionData);
        return Results.Ok(new { message = "Log received and saved successfully.", id = insertedId });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error saving log to MongoDB.");
        return Results.Problem("An error occurred while saving the data.", statusCode: 500);
    }
});

app.Run();

// =========================================================================
// DATA MODELS - These classes define the structure of our data
// =========================================================================

/// <summary>
/// Represents a complete test session. This is the top-level document stored in MongoDB.
/// </summary>
public class SessionData
{
    [BsonId] // Marks this property as the document's primary key.
    [BsonRepresentation(BsonType.String)] // Store the Guid as a standard string (UUID).
    public Guid Id { get; set; }

    public required string SessionId { get; set; }
    public required string UserAgent { get; set; }
    public required DeviceInfo Device { get; set; }
    public DateTime ClientStartTime { get; set; }
    public DateTime? ClientEndTime { get; set; }
    public required List<Event> Events { get; set; }
}

/// <summary>
/// Represents a single event that occurred during the session.
/// </summary>
public record Event(
    long Timestamp,
    string EventType,
    object Data // Allows for flexible data structures for different event types
);

/// <summary>
/// Contains detailed information about the device and screen used for the test.
/// </summary>
public record DeviceInfo(
    ViewportInfo Viewport,
    ScreenInfo Screen
);

public record ViewportInfo(int Width, int Height);
public record ScreenInfo(int Width, int Height, double PixelRatio);

// =========================================================================
// MONGODB SERVICE - Handles communication with the database
// =========================================================================

public class MongoService
{
    private readonly IMongoCollection<SessionData> _logCollection;
    private readonly ILogger<MongoService> _logger;

    public MongoService(IConfiguration configuration, ILogger<MongoService> logger)
    {
        _logger = logger;
        var connectionString = configuration.GetConnectionString("MongoDbConnection");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("MongoDB connection string 'MongoDbConnection' not found in configuration.");
        }

        var settings = MongoClientSettings.FromUrl(new MongoUrl(connectionString));
        settings.SslSettings = new SslSettings() { EnabledSslProtocols = SslProtocols.Tls12 };
        var mongoClient = new MongoClient(settings);

        var mongoDatabase = mongoClient.GetDatabase("FelisIQ");
        _logCollection = mongoDatabase.GetCollection<SessionData>("TestSessions");
        _logger.LogInformation("MongoDB service initialized successfully.");
    }

    /// <summary>
    /// Generates a new UUID for the session and inserts it into the database.
    /// </summary>
    /// <param name="sessionData">The session data from the client.</param>
    /// <returns>The string representation of the newly generated UUID.</returns>
    public async Task<string> CreateLogEntryAsync(SessionData sessionData)
    {
        // Generate a new, database-agnostic UUID before insertion.
        sessionData.Id = Guid.NewGuid();

        await _logCollection.InsertOneAsync(sessionData);
        _logger.LogInformation("Successfully inserted session data for SessionId: {SessionId} with DB ID: {DbId}", sessionData.SessionId, sessionData.Id);

        // Return the string representation of the Guid.
        return sessionData.Id.ToString();
    }
}
