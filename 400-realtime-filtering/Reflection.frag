#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: texture2DLatLong  = require(../local_modules/glsl-texture2d-latlong)
#pragma glslify: rgbe2rgb  = require(../local_modules/glsl-rgbe2rgb)
#pragma glslify: toGamma  = require(glsl-gamma/out)
#pragma glslify: tonemapReinhard  = require(../local_modules/glsl-tonemap-reinhard)

uniform mat4 uInverseViewMatrix;
uniform sampler2D uReflectionMap;
uniform sampler2D uHammersleyPointSetMap;
uniform float uExposure;

varying vec3 ecPosition;
varying vec3 ecNormal;

//float PI = 3.1415926536;

//Port from HLSL to GLSL
float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}

vec3 sampleEvnMap(vec3 dir) {
    return rgbe2rgb(texture2DLatLong(uReflectionMap, dir));
}

//Sampled from a texture generated by code based on
//http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
vec2 Hammersley(int i, int N) {
    return texture2D(uHammersleyPointSetMap, vec2(0.5, (float(i) + 0.5)/float(N))).rg;
}

//Based on Real Shading in Unreal Engine 4
//Visibility Term: Schlick-Smith
//                                          n.v           //                           (0.8 + 0.5*a)^2
//G(l,v,h) = G1(l)* G1(v)    G1(v) = -----------------    //  where is that from?  k = ---------------
//                                   (n.v) * (1-k) + k    //                                  2
float G_Smith(float Roughness, float NoV, float NoL) {
    //float a = Roughness * Roughness;
    //float k = pow(0.8 + 0.5 * a, 2.0) / 2.0;
    float a = Roughness + 1;
    float k = a * a / 8;
    float G1l = NoL / (NoL * (1.0 - k) + k);
    float G1v = NoV / (NoV * (1.0 - k) + k);
    float Glvn = G1l * G1v;
    return Glvn;
}

//Based on Real Shading in Unreal Engine 4
vec3 ImportanceSampleGGX(vec2 Xi, float Roughness, vec3 N) {
    float a = Roughness * Roughness;
    float Phi = 2.0 * PI * Xi.x;
    float CosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;

    //TODO: What's the coordinate system here? shoudn't up vector be 0,1,0
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = cross(N, TangentX);

    //Tangent to World Space
    //return TangentX * H.x + TangentY * H.y + N * H.z;
    return vec3(CosTheta);
}

//Based on Real Shading in Unreal Engine 4
//TODO: N & L, which coordinate space they are in?
vec3 SpecularIBL(vec3 SpecularColor, float Roughness, vec3 N, vec3 V) {
    vec3 SpecularLighting = vec3(0.0);
    const int NumSamples = 128;//1024;
    for(int i=0; i<NumSamples; i++) {
        vec2 Xi = Hammersley(i, NumSamples);
        vec3 H = ImportanceSampleGGX(Xi, Roughness, N);
        vec3 L = 2.0 * dot(V, H) * H - V;

        float NoV = saturate(dot(N, V));
        float NoL = saturate(dot(N, L));
        float NoH = saturate(dot(N, H));
        float VoH = saturate(dot(V, V));

        if (NoL > 0.0) {
            vec3 SampleColor = sampleEvnMap(L);
            float G = G_Smith(Roughness, NoV, NoL);
            float Fc = pow(1.0 - VoH, 5.0);
            vec3 F = (1.0 - Fc) * SpecularColor;

            SpecularLighting += SampleColor * F * G * VoH / (NoH * NoV);
        }
    }
    //return SpecularLighting;
    return SpecularLighting / NumSamples;
}

void main() {
    vec3 ecEyeDir = normalize(-ecPosition);
    vec3 wcEyeDir = vec3(uInverseViewMatrix * vec4(ecEyeDir, 0.0));
    vec3 wcNormal = vec3(uInverseViewMatrix * vec4(ecNormal, 0.0));

    vec3 reflectionWorld = reflect(-wcEyeDir, normalize(wcNormal));
    //gl_FragColor.rgb = sampleEvnMap(reflectionWorld);
    gl_FragColor.rgb = SpecularIBL(vec3(0.99), 0.01, ecNormal, ecEyeDir);
    gl_FragColor.rgb *= uExposure;
    //gl_FragColor.rgb = tonemapReinhard(gl_FragColor.rgb);
    //gl_FragColor.rgb = toGamma(gl_FragColor.rgb);
    gl_FragColor.a = 1.0;
}